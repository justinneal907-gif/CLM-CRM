/* User-requested agency portfolio import, October 14, 2026. */
(function () {
  'use strict';
  const marker = 'agencyPortfolioPhotos20261014';
  const canonical = value => String(value || '').split(/[?#]/)[0];
  window.CLMImportAgencyPhotos = async function (data) {
    if (data.recovery?.[marker]) return data;
    try {
      const response = await fetch('assets/data/agency-photos-20261014.json');
      if (!response.ok) throw new Error('Agency photo manifest unavailable');
      const manifest = await response.json();
      if (manifest.models?.length !== 58 || manifest.photoCount !== 1153) throw new Error('Incomplete agency photo manifest');
      data.models = data.models || [];
      data.photoLibrary = data.photoLibrary || {};
      let added = 0;
      for (const entry of manifest.models) {
        const profiles = new Set(entry.profileUrls.map(canonical));
        let model = data.models.find(m => profiles.has(canonical(m.profileUrl)))
          || data.models.find(m => m.id === entry.modelId);
        if (!model) {
          model = { ...entry.model };
          data.models.push(model);
        }
        const id = model.id;
        const library = data.photoLibrary[id] = data.photoLibrary[id] || [];
        const seen = new Set(library.flatMap(p => [canonical(photoURL(p)), canonical(p.sourceUrl)]).filter(Boolean));
        for (const photo of entry.photos) {
          if (seen.has(canonical(photo.url)) || seen.has(canonical(photo.sourceUrl))) continue;
          const deleted = data.deletedPhotoKeys?.[id] || [];
          const hidden = data.hiddenGalleryPhotoKeys?.[id] || [];
          if ([photo.url, photo.sourceUrl].some(url => deleted.includes(photoKey(url)) || hidden.includes(galleryPhotoKey(url)))) continue;
          library.push({ ...photo });
          seen.add(canonical(photo.url));
          seen.add(canonical(photo.sourceUrl));
          added++;
        }
      }
      data.recovery = { ...data.recovery, [marker]: true, agencyPortfolioPhotos20261014Count: added };
    } catch (error) {
      console.warn('Agency photos could not be imported; the next reload will retry.', error);
    }
    return data;
  };
})();
