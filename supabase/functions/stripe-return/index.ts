// stripe-return: where Stripe's setup pages send a vendor back to (#209). A
// small page saying to go back to the Wedded app, which checks the account
// again when it comes to the front. No login (verify_jwt = false).

const PAGE = (again: boolean) =>
  `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Wedded</title>
<style>
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #F2F2F7;
    font: 18px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #1C1C1E; }
  main { max-width: 420px; padding: 32px 24px; text-align: center; }
  h1 { font-size: 26px; margin: 0 0 12px; color: #8E1537; }
  p { margin: 0; color: #3C3C43; }
</style>
</head>
<body>
<main>
  <h1>${again ? 'Almost there' : "You're all set"}</h1>
  <p>${
    again
      ? 'That link ran out. Go back to the Wedded app and tap Get paid through Wedded again.'
      : 'Close this page and go back to the Wedded app. My business will show when families can pay you.'
  }</p>
</main>
</body>
</html>`;

Deno.serve((request) => {
  const again = new URL(request.url).searchParams.get('again') === '1';
  return new Response(PAGE(again), {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
});
