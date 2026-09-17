from pathlib import Path
from urllib.parse import urljoin, urlparse, urldefrag
from concurrent.futures import ThreadPoolExecutor, as_completed
from bs4 import BeautifulSoup
import requests, re, json, html as htmlmod, unicodedata
from datetime import datetime, timezone
from xml.etree import ElementTree as ET

ROOT='https://www.chezlesmannequins.com'
SITEMAP=ROOT+'/sitemap.xml'
TODAY='2026-09-17'
INDEX=Path('index.html')
REPORT=Path('.github/website-roster-sync-report.json')
HEADERS={'User-Agent':'Mozilla/5.0 (compatible; CLM CRM roster sync/1.0)'}
TIMEOUT=20

BOARD_MAP={
 'women':('New York','Women'), 'men-5':('New York','Men'), 'curve':('New York','Curve'),
 'development':('New York','Development'), 'petites':('New York','Petites (legacy board)'),
 'commercialnewyorkcity':('New York','Commercial (legacy board)'),
 'women-2':('London','Women'), 'men-2':('London','Men'), 'portfolio-2-1':('London','Commercial (legacy board)'),
 'petites-2':('London','Petites (legacy board)'), 'lmain':('London','Main'),
 'women-3':('Milan','Women'),
 'women-5':('Miami','Women'), 'men-1':('Miami','Men'), 'petites-5':('Miami','Petites (legacy board)'),
 'women111':('Los Angeles','Women'), 'men-79':('Los Angeles','Men'), 'commercial-111':('Los Angeles','Commercial (legacy board)'),
 'curve-1':('Los Angeles','Curve (legacy board)'), 'petites-73':('Los Angeles','Petites (legacy board)'),
 'women-4':('Paris','Women (legacy board)'),
 'men-4':('International','Men (legacy board)'), 'curve-2':('International','Curve (legacy board)'),
 'women-1':('International','Women (legacy board)'), 'women-81':('International','Women (legacy board)'),
 'women7':('International','Women (legacy board)'), 'men-72':('International','Men (legacy board)')
}
KNOWN_BOARDS=list(BOARD_MAP)
PREFIX_RE=re.compile(r'^(women|men|curve|development|petites|commercial|portfolio|lmain|main)',re.I)
GENERIC={'women','men','curve','development','petites','commercial','main','model','models','portfolio','chez les mannequins','model interview','polaroids','instagram','book','contact'}
LABELS=['Height','Bust','Chest','Waist','Hip','Hips','Shoe','Dress','Hair','Eyes','Tattoos','Age','Ethnicity','Country']

session=requests.Session(); session.headers.update(HEADERS)

def get(url):
    r=session.get(url,timeout=TIMEOUT,allow_redirects=True)
    r.raise_for_status(); return r

def clean_url(url):
    url=urldefrag(urljoin(ROOT,url))[0]
    p=urlparse(url)
    if p.netloc not in ('www.chezlesmannequins.com','chezlesmannequins.com'): return ''
    return 'https://www.chezlesmannequins.com'+p.path.rstrip('/')

def collect_sitemap(url, seen=None):
    seen=seen or set()
    if url in seen:return set()
    seen.add(url)
    try:r=get(url)
    except Exception:return set()
    out=set()
    try:root=ET.fromstring(r.text)
    except Exception:return out
    tag=root.tag.rsplit('}',1)[-1]
    locs=[(e.text or '').strip() for e in root.iter() if e.tag.rsplit('}',1)[-1]=='loc' and e.text]
    if tag=='sitemapindex':
        for loc in locs:out |= collect_sitemap(loc,seen)
    else:
        for loc in locs:
            u=clean_url(loc)
            if u:out.add(u)
    return out

def board_info(prefix):
    if prefix in BOARD_MAP:return BOARD_MAP[prefix]
    low=prefix.lower()
    if low.startswith('women'):return ('International','Women (legacy board)')
    if low.startswith('men'):return ('International','Men (legacy board)')
    if low.startswith('curve'):return ('International','Curve (legacy board)')
    if low.startswith('petites'):return ('International','Petites (legacy board)')
    if low.startswith('commercial') or low.startswith('portfolio'):return ('International','Commercial (legacy board)')
    if 'main' in low:return ('International','Main')
    return ('International','Model (legacy board)')

def is_candidate(url):
    parts=[x for x in urlparse(url).path.split('/') if x]
    if len(parts)<2:return False
    return bool(PREFIX_RE.match(parts[0]))

def board_urls_and_links():
    links=set(); boards={}
    for prefix in KNOWN_BOARDS:
        u=f'{ROOT}/{prefix}'
        try:
            r=get(u); soup=BeautifulSoup(r.text,'html.parser')
            found=set()
            for a in soup.find_all('a',href=True):
                x=clean_url(a['href'])
                if x and is_candidate(x): found.add(x); links.add(x)
            boards[prefix]={'status':r.status_code,'links':sorted(found)}
        except Exception as e: boards[prefix]={'error':str(e),'links':[]}
    return links,boards

def collapse_spaced_name(s):
    s=htmlmod.unescape(re.sub(r'\s+',' ',s or '').strip())
    s=re.sub(r'\s+[—–-]\s+CHEZ LES MANNEQUINS.*$','',s,flags=re.I).strip()
    tokens=s.split()
    if tokens and sum(1 for t in tokens if len(re.sub(r"[^A-Za-z']",'',t))<=1) >= max(2,int(len(tokens)*0.65)):
        s=''.join(tokens)
        s=re.sub(r'-+','-',s)
    # Turn all-caps website labels into readable names without changing apostrophes/hyphens.
    if s.isupper() or (s and sum(c.isupper() for c in s)>sum(c.islower() for c in s)*2):
        s=' '.join(w[:1].upper()+w[1:].lower() if w else w for w in s.split(' '))
    return s.strip(' -|')

def measurement_candidate(soup):
    candidates=[]
    for tag in soup.find_all(['p','div','span','li','h3','h4']):
        t=' '.join(tag.stripped_strings)
        if re.search(r'\bHeight\s*:',t,re.I) and sum(bool(re.search(rf'\b{x}\s*:',t,re.I)) for x in ['Bust','Chest','Waist','Hip','Hips'])>=2:
            if len(t)<=800:candidates.append(t)
    if not candidates:
        text=' | '.join(soup.stripped_strings)
        m=re.search(r'(Height\s*:.*?)(?=(?:MODEL INTERVIEW|POLAROIDS|Instagram|Chez Les Mannequins|$))',text,re.I)
        if m:candidates=[m.group(1)]
    if not candidates:return ''
    return min(candidates,key=len)

def parse_stats(raw):
    if not raw:return ''
    t=re.sub(r'\s+',' ',htmlmod.unescape(raw)).strip()
    pattern='|'.join(map(re.escape,LABELS))
    found=[]
    for m in re.finditer(rf'\b({pattern})\s*:\s*',t,re.I):
        start=m.end(); nxt=re.search(rf'\s+\b(?:{pattern})\s*:\s*',t[start:],re.I)
        end=start+(nxt.start() if nxt else min(len(t)-start,80))
        value=t[start:end].strip(' |,;')
        value=re.split(r'\s{2,}|\s+(?:MODEL INTERVIEW|POLAROIDS|Instagram|Chez Les Mannequins)\b',value,1,flags=re.I)[0].strip(' |,;')
        if value and len(value)<=70:
            label=m.group(1).title(); label='Hip' if label=='Hips' else label
            if not any(x[0].lower()==label.lower() for x in found):found.append((label,value))
    if not any(k=='Height' for k,v in found):return ''
    return ' | '.join(f'{k}: {v}' for k,v in found)

def extract_name(soup,url,raw_stats):
    # Prefer headings nearest the measurements.
    statnode=None
    for tag in soup.find_all(['p','div','span','li']):
        txt=' '.join(tag.stripped_strings)
        if raw_stats and txt==raw_stats: statnode=tag; break
    if statnode:
        for h in statnode.find_all_previous(['h1','h2','h3','h4'],limit=8):
            n=collapse_spaced_name(' '.join(h.stripped_strings))
            if n and n.lower() not in GENERIC and not any(x in n.lower() for x in ['model interview','polaroid']):return n
    for sel in [('meta',{'property':'og:title'}),('meta',{'name':'twitter:title'})]:
        tag=soup.find(sel[0],attrs=sel[1])
        if tag and tag.get('content'):
            n=collapse_spaced_name(tag['content'])
            if n and n.lower() not in GENERIC:return n
    if soup.title:
        n=collapse_spaced_name(soup.title.get_text(' ',strip=True))
        if n and n.lower() not in GENERIC:return n
    slug=urlparse(url).path.rstrip('/').split('/')[-1]
    return re.sub(r'-+',' ',slug).title()

def extract_photo(soup):
    choices=[]
    for img in soup.find_all('img'):
        for attr in ['data-src','data-image','src']:
            u=img.get(attr)
            if not u:continue
            u=urljoin(ROOT,u)
            low=u.lower()
            if ('squarespace-cdn.com' in low or 'images.squarespace' in low) and not any(x in low for x in ['logo','favicon','icon']):
                choices.append(u);break
    if choices:return choices[0]
    og=soup.find('meta',property='og:image')
    return urljoin(ROOT,og.get('content')) if og and og.get('content') else ''

def parse_profile(url,active_links):
    try:
        r=get(url); soup=BeautifulSoup(r.text,'html.parser')
        raw=measurement_candidate(soup); stats=parse_stats(raw)
        if not stats:return None
        parts=[x for x in urlparse(url).path.split('/') if x]; prefix=parts[0]
        name=extract_name(soup,url,raw)
        if not name or name.lower() in GENERIC:return None
        location,division=board_info(prefix)
        photo=extract_photo(soup)
        active=url in active_links
        hair='';eyes=''
        for label in ('Hair','Eyes'):
            m=re.search(rf'(?:^|\|)\s*{label}:\s*([^|]+)',stats,re.I)
            if m:
                if label=='Hair':hair=m.group(1).strip()
                else:eyes=m.group(1).strip()
        slug=re.sub(r'[^a-z0-9]+','-',unicodedata.normalize('NFKD',name).encode('ascii','ignore').decode().lower()).strip('-') or parts[-1]
        rid='site-'+re.sub(r'[^a-z0-9]+','-',prefix.lower()).strip('-')+'-'+slug
        notes='Published on Chez Les Mannequins website.' + (' Linked from the current board page.' if active else ' Published profile is not currently linked from its board page.')
        rec={'id':rid,'name':name,'location':location,'division':division,'measurements':stats,'profileUrl':url,'photoUrl':photo,'photoFilename':urlparse(photo).path.rsplit('/',1)[-1] if photo else '', 'source':'Chez Les Mannequins website sync','sourceDate':TODAY,'activeBoard':active,'notes':notes}
        if hair:rec['hair']=hair
        if eyes:rec['eyes']=eyes
        return rec
    except Exception as e:return {'_error':str(e),'profileUrl':url}

def norm(s):
    return re.sub(r'[^a-z0-9]+',' ',unicodedata.normalize('NFKD',str(s or '')).encode('ascii','ignore').decode().lower()).strip()
def base_div(s):return norm(re.sub(r'\s*\([^)]*\)\s*','',str(s or '')))
def protected(rec):
    src=(rec.get('source') or '').lower()
    return any(x in src for x in ['user','draft','agency submission'])

def merge_site(existing,site):
    out=[dict(x) for x in existing]; added=[]; updated=[]
    for s in site:
        purl=norm(s.get('profileUrl'))
        match=None
        for x in out:
            if purl and norm(x.get('profileUrl') or x.get('profile'))==purl:match=x;break
        if match is None:
            candidates=[x for x in out if norm(x.get('name'))==norm(s.get('name')) and norm(x.get('location'))==norm(s.get('location')) and base_div(x.get('division'))==base_div(s.get('division'))]
            if len(candidates)==1:match=candidates[0]
        if match:
            before=json.dumps(match,sort_keys=True,ensure_ascii=False)
            if not protected(match):
                for k in ['name','location','division','measurements','profileUrl','photoUrl','photoFilename','hair','eyes','activeBoard']:
                    if s.get(k) not in (None,''):match[k]=s[k]
                match['source']='Chez Les Mannequins website sync';match['sourceDate']=TODAY
                match['notes']=s['notes']
            else:
                for k in ['profileUrl','photoUrl','photoFilename','hair','eyes']:
                    if not match.get(k) and s.get(k):match[k]=s[k]
                match['websiteProfileUrl']=s['profileUrl'];match['websiteActiveBoard']=s['activeBoard']
            if json.dumps(match,sort_keys=True,ensure_ascii=False)!=before:updated.append({'name':match.get('name'),'profileUrl':s['profileUrl']})
        else:
            out.append(s);added.append({'name':s['name'],'profileUrl':s['profileUrl'],'location':s['location'],'division':s['division']})
    return out,added,updated

def main():
    html=INDEX.read_text(encoding='utf-8')
    m=re.search(r'const BASE_ROSTER=(\[.*?\]);\nconst NICHE_MAP=',html,re.S)
    if not m:raise SystemExit('BASE_ROSTER block not found')
    existing=json.loads(m.group(1))

    sitemap_urls=collect_sitemap(SITEMAP)
    active_links,boards=board_urls_and_links()
    candidates={u for u in sitemap_urls|active_links if is_candidate(u)}
    # Safety: include currently known profile URLs so the crawl never regresses if Squarespace omits old collection items from sitemap.
    for x in existing:
        u=clean_url(x.get('profileUrl',''))
        if u and is_candidate(u):candidates.add(u)

    scraped=[]; failures=[]
    with ThreadPoolExecutor(max_workers=10) as ex:
        futs={ex.submit(parse_profile,u,active_links):u for u in sorted(candidates)}
        for fut in as_completed(futs):
            result=fut.result()
            if not result:continue
            if result.get('_error'):failures.append(result);continue
            scraped.append(result)
    # Dedupe by exact profile URL; sort for deterministic commits.
    by_url={x['profileUrl']:x for x in scraped}
    scraped=sorted(by_url.values(),key=lambda x:(x['location'],x['division'],norm(x['name']),x['profileUrl']))
    if len(scraped)<25:raise SystemExit(f'Safety stop: only {len(scraped)} model profiles parsed')

    merged,added,updated=merge_site(existing,scraped)
    roster_json=json.dumps(merged,ensure_ascii=False,separators=(',',':'))
    html=html[:m.start(1)]+roster_json+html[m.end(1):]
    INDEX.write_text(html,encoding='utf-8')

    board_counts={}
    for x in scraped:
        key=f"{x['location']} / {x['division']}"
        board_counts[key]=board_counts.get(key,0)+1
    report={'syncedAt':datetime.now(timezone.utc).isoformat(),'sitemapUrlCount':len(sitemap_urls),'candidateProfileCount':len(candidates),'scrapedModelCount':len(scraped),'previousRosterCount':len(existing),'finalRosterCount':len(merged),'addedCount':len(added),'updatedCount':len(updated),'added':added,'updated':updated,'boardCounts':dict(sorted(board_counts.items())),'failures':failures[:100],'boardDiscovery':{k:{'linkCount':len(v.get('links',[])),'error':v.get('error','')} for k,v in boards.items()}}
    REPORT.parent.mkdir(parents=True,exist_ok=True);REPORT.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')

    # Validate embedded JavaScript after patching.
    scripts=re.findall(r'<script(?:\s[^>]*)?>(.*?)</script>',html,re.S|re.I)
    Path('/tmp/app.js').write_text('\n'.join(scripts),encoding='utf-8')
    print(json.dumps({'scraped':len(scraped),'added':len(added),'updated':len(updated),'final':len(merged)},indent=2))

if __name__=='__main__':main()
