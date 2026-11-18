# Send one package to multiple recipients

The package builder can create a separate Gmail draft for each recipient while keeping the package content and selected models the same. Each copy uses that recipient’s first name in the greeting and their queued email address in the To field. The CRM’s usual agency CC is included on each Gmail draft.

## Use it

1. Open **Create package** and build the package as usual. Select the models, edit the subject and email preview, and save the package.
2. In **Send this package to multiple recipients**, paste one recipient per line as `Name, email`, or paste two columns from a spreadsheet into **Paste recipient list**. Known CRM contacts get their name filled in automatically. Choose **Add pasted recipients**. Invalid rows stay in the box so you can correct them. You can also add one person at a time with **Add another email**.
3. Check the queued names and email addresses. Remove anyone who should not receive the package.
4. Choose **Create personalized Gmail drafts**. The CRM saves one separate package copy and Gmail draft per recipient. The drafts are created one at a time; the CRM reports any address that failed.
5. Review the individual drafts in Work Gmail, then send them from Gmail.

## Notes

- Batch drafts use only the recipients in the multi-recipient list. The **Recipient email** field above is for creating a single draft and is not required for a batch.
- Recipients are kept with the saved base package so the list can be reused. Recipient addresses are not exposed to one another because the CRM creates individual drafts rather than one message with multiple To addresses.
- Creating the drafts does not send them. Review each draft and send from Work Gmail.
- If Gmail is not connected, connect Work Gmail in the package builder before creating drafts.
