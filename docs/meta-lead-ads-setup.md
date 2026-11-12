# Facebook / Instagram lead ads — platform setup

Companies link their Facebook Page from the admin («الحملات › استقبال العملاء تلقائياً»); leads from
Facebook and Instagram lead ads then arrive on their own, with the campaign and the source set.
No Zapier or Make is needed, and Meta charges nothing for the API (only the ads themselves cost money).

The feature stays **off** until the platform owner creates one Meta app and sets its keys (below).
Nothing here is per company.

## One-time setup (platform owner)

1. Create a Meta developer account and an app of type **Business** at developers.facebook.com.
2. Add the products **Facebook Login** and **Webhooks**.
3. Facebook Login → Settings → *Valid OAuth Redirect URIs*: `<API_BASE_URL>/v1/meta/callback`.
4. Webhooks → object **Page** → Callback URL `<API_BASE_URL>/v1/meta/webhook`, Verify token = the value of
   `META_WEBHOOK_VERIFY_TOKEN`, then subscribe to the **leadgen** field.
5. App settings → Basic: add a privacy-policy URL and the app icon.
6. Set the API environment (Railway): `META_APP_ID`, `META_APP_SECRET`, `META_WEBHOOK_VERIFY_TOKEN`
   (any long random string), and optionally `WEB_ADMIN_URL`, `META_GRAPH_VERSION`,
   `META_TOKEN_ENCRYPTION_KEY`. Never put these in files or chat.
7. **App Review** (required before other companies can use it): request Advanced Access for
   `leads_retrieval`, `pages_show_list`, `pages_read_engagement` and `pages_manage_metadata`, with a screen
   recording of a company linking its Page and a lead arriving. Business verification may be asked for.
   Until approved, only people with a role on the app (admins, developers, testers) can link a Page —
   enough to test end to end.
8. Switch the app to **Live** once review passes.

## How a company links a Page

Admin → «استقبال العملاء تلقائياً» → «ربط فيسبوك» → sign in to Facebook and allow access → choose the Page and the
campaign / project its leads go under → done. The person must be an admin of the Facebook Page.

## What is stored

Per linked Page: its id and name, its access token **sealed** (AES-256-GCM; key from
`META_TOKEN_ENCRYPTION_KEY`, else `JWT_REFRESH_SECRET` — rotating that key means companies relink),
the campaign / project, and a lead counter. Each Facebook lead id is remembered so a repeated delivery is
taken once. Unlinking deletes the token and stops the events.

## Notes

- A form without a phone-number question cannot be recorded (leads are matched and called by phone).
- A Page serves one company at a time.
- Instagram lead ads run through the same Facebook Page, so they arrive the same way (source `ig`).
- TikTok lead forms are not part of this; they still use the intake key (Zapier / Make) path.
