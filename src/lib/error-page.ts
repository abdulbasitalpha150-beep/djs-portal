export function renderErrorPage(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>This page didn't load</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      :root {
        --color-bg-primary: #0C0A09;
        --color-text-primary: #F5F1EA;
        --color-surface-card: #171311;
        --color-border: #403734;
        --color-text-secondary: #BCA88F;
        --color-cta-bg: #B96F1F;
        --color-cta-text: #FFF9F1;
      }
      body { font: 15px/1.5 system-ui, -apple-system, sans-serif; background: var(--color-bg-primary); color: var(--color-text-primary); display: grid; place-items: center; min-height: 100vh; margin: 0; padding: 1.5rem; }
      .card { max-width: 28rem; width: 100%; text-align: center; padding: 2rem; background: var(--color-surface-card); border: 1px solid var(--color-border); border-radius: 1rem; box-shadow: 0 12px 30px rgba(12, 10, 9, 0.32); }
      h1 { font-size: 1.25rem; margin: 0 0 0.5rem; color: var(--color-text-primary); }
      p { color: var(--color-text-secondary); margin: 0 0 1.5rem; }
      .actions { display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap; }
      a, button { padding: 0.5rem 1rem; border-radius: 0.375rem; font: inherit; cursor: pointer; text-decoration: none; border: 1px solid transparent; }
      .primary { background: var(--color-cta-bg); color: var(--color-cta-text); }
      .secondary { background: var(--color-surface-card); color: var(--color-text-primary); border-color: var(--color-border); }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>This page didn't load</h1>
      <p>Something went wrong on our end. You can try refreshing or head back home.</p>
      <div class="actions">
        <button class="primary" onclick="location.reload()">Try again</button>
        <a class="secondary" href="/">Go home</a>
      </div>
    </div>
  </body>
</html>`;
}
