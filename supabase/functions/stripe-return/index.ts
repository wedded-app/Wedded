// stripe-return: where Stripe's setup pages send a vendor back to (#209), and
// Wedded Pro's Checkout and billing pages (#220, ?pro=success|canceled) until
// the website has its own. A small page saying to go back to the Wedded app,
// which checks again when it comes to the front. It never grants anything.
// No login (verify_jwt = false).

type Words = { title: string; body: string };

const WORDS: Record<'connected' | 'again' | 'proSuccess' | 'proCanceled' | 'proBilling', Words> = {
  connected: {
    title: "You're all set",
    body:
      'Close this page and go back to the Wedded app. My business will show when families can pay you.',
  },
  again: {
    title: 'Almost there',
    body: 'That link ran out. Go back to the Wedded app and tap Get paid through Wedded again.',
  },
  proSuccess: {
    title: 'Welcome to Wedded Pro',
    body:
      'Thank you! Go back to the Wedded app to see the families looking for you. It can take a minute to show.',
  },
  proCanceled: {
    title: 'No charge made',
    body: 'Nothing was paid. Go back to the Wedded app whenever you are ready.',
  },
  proBilling: {
    title: 'All saved',
    body: 'Go back to the Wedded app. Your Wedded Pro plan shows there.',
  },
};

function wordsFor(params: URLSearchParams): Words {
  const pro = params.get('pro');
  if (pro === 'success') return WORDS.proSuccess;
  if (pro === 'canceled') return WORDS.proCanceled;
  if (pro === 'billing') return WORDS.proBilling;
  if (params.get('again') === '1') return WORDS.again;
  return WORDS.connected;
}

const PAGE = (words: Words) =>
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
  <h1>${words.title}</h1>
  <p>${words.body}</p>
</main>
</body>
</html>`;

Deno.serve((request) => {
  return new Response(PAGE(wordsFor(new URL(request.url).searchParams)), {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
});
