// Inventory Risk Dashboard case study: dashboard tour and markdown planner
(() => {
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Dashboard tour: crossfades through the five pages, tabs jump to one */
  const imgs = $$('.frame__screen img');
  const tabs = $$('.pp-tabs button');
  const pages = ['Summary', 'Aging', 'Liquidation', 'Sellers', 'About'];
  const captions = [
    'The problem in one screen: how much stock is at risk, how fast it is growing, and where it sits.',
    'Where old stock sits: a waterfall of stock by age, a category heat map, and every SKU ranked by risk.',
    'The decision: choose a markdown, see the loss it avoids, and get a ranked action list by SKU.',
    'Where risk concentrates: 20 sellers hold 27% of it, mostly in the Southeast.',
    'How the data was built and how value at risk is measured, on the dashboard itself.',
  ];
  let current = 0, timer = null;
  const show = (n) => {
    current = n;
    imgs.forEach((im, k) => im.classList.toggle('is-on', k === n));
    tabs.forEach((t, k) => t.setAttribute('aria-selected', String(k === n)));
    $('#tour-caption').textContent = captions[n];
    $('#tour-title').textContent = `Inventory Risk Dashboard  ·  ${pages[n]}`;
    $('#tour-link').href = imgs[n].getAttribute('src');
  };
  const play = () => {
    clearInterval(timer);
    if (!reduceMotion) timer = setInterval(() => show((current + 1) % imgs.length), 5000);
  };
  tabs.forEach((t, k) => t.addEventListener('click', () => { show(k); play(); }));
  play();

  /* Markdown planner: same formula and inputs as the Power BI model (as of 31 July 2018) */
  const RISK = 494232.63;          // value at risk, at cost
  const RISK_AT_LIST = 804571.48;  // the same units at list price
  const RECOVERY = 0.252817;       // share of cost recovered by past clearances
  const RESPONSE = 0.15;           // share of at risk units cleared per 10 points of markdown
  const lossWith = (m) => {
    const sold = Math.min(1, RESPONSE * m / 0.1);
    return RISK - (RISK_AT_LIST * sold * (1 - m) + RISK * (1 - sold) * RECOVERY);
  };
  const lossWait = RISK * (1 - RECOVERY);
  const k = (v) => 'R$' + Math.abs(Math.round(v / 1000)).toLocaleString('en-US') + 'K';
  const range = $('#range');
  const render = () => {
    const m = range.value / 100;
    const act = lossWith(m);
    $('#md').textContent = range.value + '%';
    $('#act').textContent = act < 0 ? k(act) + ' gain' : k(act);
    $('#actbar').style.width = Math.max(0, act / lossWait * 100) + '%';
    $('#saved').textContent = k(Math.max(0, lossWait - act));
    $('#savedlbl').textContent = m === 0 ? 'no markdown, no saving' : 'saved by acting now';
  };
  $('#wait').textContent = k(lossWait);
  range.addEventListener('input', render);
  $('#best').addEventListener('click', () => {
    let best = 0;
    for (let v = 0; v <= 60; v += 5) if (lossWith(v / 100) < lossWith(best / 100)) best = v;
    range.value = best;
    render();
  });
  render();
})();
