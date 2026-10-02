Run from the repository root:

```sh
npm install --prefix tests
npm test --prefix tests
```

The integrity suite uses jsdom to exercise actual DOM serialization and image-source sanitization. It checks MIME image association, Gmail read-back byte comparison, HTML/recipient/subject mismatches, duplicate and missing attachments, stale Gmail image URLs, the required image review, and changes during image preparation. It does not send messages or use a live Gmail account.
