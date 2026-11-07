// Scénario de bout en bout : un téléphone et un PC, mode avion, synchronisation.
// Prérequis : `make run` (ou un serveur sur BASE_URL) et Playwright avec Chromium.
// Usage : node frontend/e2e/offline-sync.cjs [dossier pour les captures]
const { chromium, devices } = require("playwright");

const BASE = process.env.BASE_URL || "http://127.0.0.1:8000";
const SHOTS = process.argv[2];

function check(cond, msg) {
  if (!cond) throw new Error(`ÉCHEC : ${msg}`);
  console.log(`ok  ${msg}`);
}

async function shot(page, name) {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: false });
}

async function onboarding(page) {
  await page.goto(BASE);
  await page.waitForSelector("text=Qui compose ton foyer");
  await page.fill('input[aria-label="Nom"]', "Wilson");
  await page.click('button:has-text("Continuer")');
  await page.click('button:has-text("Commencer l\'interview")');
  const WANT = ["Une lampe sans réseau", "numéros d'urgence", "Antalgique, pansements", "Issues de secours",
    "réflexes en cas d'alerte", "Fréquence de la radio", "Papiers d'identité rangés", "Clés, papiers et chaussures",
    "guide officiel", "Un proche à moins de 30 min", "Numéros d'écoute notés", "on fuit et on alerte", "conditions de la légitime défense", "On sait quoi faire après", "Coupures d'eau", "Lampes frontales", "Trousse de premiers secours", "Pastilles", "On sait couper",
    "FR-Alert", "Contacts essentiels", "Itinéraires d'évacuation", "Copies des papiers", "Fiches médicales",
    "Inventaire des placards", "Je connais au moins deux voisins", "Deux semaines", "1 an", "💧 Eau", "Inondation"];
  for (;;) {
    for (const t of WANT) {
      const loc = page.locator(`label.option:has-text("${t}")`);
      if ((await loc.count()) && !(await loc.first().getAttribute("class")).includes("checked")) await loc.first().click();
    }
    for (const fs of await page.locator("fieldset").all()) {
      const legend = await fs.locator("legend").innerText();
      if (/véhicule|crédit|armes à feu/.test(legend)) await fs.locator('label.option:has-text("Non")').click();
    }
    const nums = page.locator(".question input[type=number]");
    for (let i = 0; i < (await nums.count()); i++) await nums.nth(i).fill(["12", "5", "2"][i] ?? "0");
    if (await page.locator('button:has-text("Suivant")').count()) await page.click('button:has-text("Suivant")');
    else break;
  }
  await page.click('button:has-text("Estimer mon niveau")');
  await page.waitForSelector("text=Voir ma colonne");
  await shot(page, "1-resultat");
  await page.click("text=Voir ma colonne");
  await page.waitForSelector("text=Ta checklist");
}

const levelText = async (page) => (await page.locator(".level-panel .eyebrow").textContent()).trim();
const syncText = async (page) => (await page.locator(".sync-badge").innerText()).trim();

(async () => {
  const browser = await chromium.launch();
  const phone = await browser.newContext({ ...devices["Pixel 7"] });
  const pc = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await phone.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));

  // 1. Onboarding sur le téléphone, en ligne
  await onboarding(p);
  check((await levelText(p)) === "Niveau 2 sur 9", `le téléphone est au niveau 2 après l'interview (${await levelText(p)})`);
  await p.waitForFunction(() => navigator.serviceWorker?.controller !== null || false, null, { timeout: 15000 }).catch(() => {});
  await p.evaluate(() => navigator.serviceWorker.ready);
  await p.locator(".sync-badge").click();
  await p.waitForFunction(() => document.querySelector(".sync-badge")?.textContent?.includes("Synchronisé"));
  check((await syncText(p)).startsWith("Synchronisé"), "l'interview est synchronisée avec le serveur");

  // 2. Objectif perso, en ligne
  await p.click('nav >> text=Objectifs');
  await p.click('button:has-text("+ Objectif perso")');
  await p.fill("#custom-title", "Croquettes du chien pour 2 semaines");
  await p.selectOption("#custom-level", "3");
  await p.click('.custom-form button:has-text("Enregistrer")');
  await p.waitForSelector('.objective:has-text("Croquettes du chien")');
  check(true, "objectif perso créé");
  await p.locator(".sync-badge").click();
  await p.waitForFunction(() => /Synchronisé/.test(document.querySelector(".sync-badge")?.textContent ?? "") && !/attente/.test(document.querySelector(".sync-badge")?.textContent ?? ""));

  // 3. Mode avion : rechargement depuis le cache, modification en attente
  await phone.setOffline(true);
  await p.reload();
  await p.waitForSelector('.objective:has-text("Croquettes du chien")', { timeout: 15000 });
  check(true, "l'app se recharge en mode avion (service worker)");
  await p.click('nav >> text=Inventaire');
  await p.fill('input[placeholder^="Packs"]', "Bidons d'eau");
  await p.locator(".stock-form input[type=number]").nth(0).fill("10");
  await p.locator(".stock-form input[type=number]").nth(1).fill("5");
  await p.click('.stock-form button:has-text("Ajouter")');
  await p.waitForSelector('td:has-text("Bidons d\'eau")');
  await p.locator(".sync-badge").click();
  await p.waitForFunction(() => document.querySelector(".sync-badge")?.textContent?.includes("Hors ligne"));
  check((await syncText(p)).includes("1 modif. en attente"), `badge hors ligne : « ${await syncText(p)} »`);
  await p.click('nav >> text=Colonne');
  const offlineLevel = await levelText(p);
  await shot(p, "2-telephone-hors-ligne");

  // 4. Le PC récupère ce qui a été synchronisé, mais pas encore le stock hors ligne
  const c = await pc.newPage();
  await c.goto(BASE);
  await c.waitForSelector("text=Ta checklist", { timeout: 15000 });
  check((await c.locator(".brand-household").innerText()) === "Mon foyer", "le PC affiche le foyer créé sur le téléphone");
  await c.click('nav >> text=Inventaire');
  check((await c.locator('td:has-text("Bidons d\'eau")').count()) === 0, "le stock saisi hors ligne n'est pas encore sur le PC");

  // 5. Retour du réseau : le téléphone envoie, le PC reçoit
  await phone.setOffline(false);
  await p.locator(".sync-badge").click();
  await p.waitForFunction(() => /Synchronisé/.test(document.querySelector(".sync-badge")?.textContent ?? "") && !/attente/.test(document.querySelector(".sync-badge")?.textContent ?? ""));
  check(true, "le téléphone a envoyé sa modification au retour du réseau");
  await c.locator(".sync-badge").click();
  await c.waitForSelector('td:has-text("Bidons d\'eau")', { timeout: 10000 });
  check(true, "le PC reçoit le stock saisi hors ligne");
  await c.click('nav >> text=Objectifs');
  await c.waitForSelector('.objective:has-text("Croquettes du chien")', { timeout: 5000 });
  check(true, "le PC voit l'objectif perso");
  await c.click('nav >> text=Colonne');
  await c.waitForSelector(".level-panel");
  check((await levelText(c)) === offlineLevel, `même niveau sur les deux appareils (${offlineLevel})`);
  await shot(c, "3-pc");

  // 6. Le moteur Python du serveur trouve le même niveau que le moteur TypeScript
  const api = await (await fetch(`${BASE}/api/dashboard`)).json();
  check(`Niveau ${api.level} sur 9` === offlineLevel, `le serveur (Python) calcule aussi le niveau ${api.level}`);

  check(errors.length === 0, `aucune erreur JavaScript (${errors.join(" | ")})`);
  await browser.close();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
