# Send one package to multiple recipients

The package builder can create a separate Gmail draft for each recipient while keeping the package content and selected models the same. Each copy uses that recipient’s name in the greeting and their email address in the To field. The CRM’s usual agency CC is included on each Gmail draft.

## Use it

1. Open **Create package** and build the package as usual. Select the models, edit the subject and email preview, and save the package.
2. In **Send this package to multiple recipients**, select one or more saved CRM contacts and choose **Add selected contacts**.
3. To add a person who is not in the CRM contact list, enter their email address. If that address belongs to an existing CRM contact, their name and company fill in automatically. Otherwise, enter the recipient’s name so the greeting can be personalized. Company is optional. Choose **Add email**.
4. Check the queued names and email addresses. Remove anyone who should not receive the package.
5. Choose **Create personalized Gmail drafts**. The CRM saves one separate package copy and Gmail draft per recipient. The drafts are created one at a time; the CRM reports any address that failed.
6. Review the individual drafts in Work Gmail, then send them from Gmail.

## Notes

- When you create a batch, the current **Recipient email** and **Contact name** fields are included along with the recipients you added in the multi-recipient list. Leave the current email blank if you only want to use the list.
- Recipients are kept with the saved base package so the list can be reused. Recipient addresses are not exposed to one another because the CRM creates individual drafts rather than one message with multiple To addresses.
- Creating the drafts does not send them. Review each draft and send from Work Gmail.
- If Gmail is not connected, connect Work Gmail in the package builder before creating drafts.
