// Local demo only (scripts/demo.sh): canned conversations between demo accounts, used when Stream isn't
// configured. Never reached outside DRAFFT_ENV=local.
import type { ChatMessage } from "./stream";

const demo = (n: number) => `de000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

type Line = [who: number, minutesAgo: number, text: string, image?: string];

const scripts: Record<string, Line[]> = {
  "6-7": [
    [7, 2900, "Hey! Your bike ride along the Rhône looked amazing"],
    [6, 2890, "Thanks. You swim? We could train together this weekend"],
    [7, 2800, "Maybe, I'm in Paris this month though"],
    [6, 1500, "So? Paris Lyon is 2 hours. Saturday 8am"],
    [7, 1490, "I'd rather not travel for a first session, sorry"],
    [6, 470, "Seriously? You wasted my time"],
    [6, 468, "Girls like you are all the same, you think you're too good for everyone"],
    [6, 440, "Answer me"],
    [7, 430, "I'm reporting you."],
  ],
  "4-8": [
    [8, 8000, "Salut Camille, padel ce week-end ?"],
    [4, 7900, "Avec plaisir, samedi matin ?"],
    [8, 1300, "Regarde ce que je fais après la salle", "u/de000000-0000-4000-8000-000000000008/chat/demo/c1.jpg"],
    [8, 1290, "", "u/de000000-0000-4000-8000-000000000008/chat/demo/c2.jpg"],
    [4, 1200, "Je t'ai rien demandé. Stop."],
    [8, 1190, "Détends toi c'est de l'art"],
  ],
  "2-7": [
    [2, 17000, "Hi Sarah! I'm a certified coach, I can get you ready for your triathlon"],
    [7, 16900, "Oh nice, what do you have in mind?"],
    [2, 16800, "12-week programme, normally 199€, for you 49€ if you pay today"],
    [2, 16790, "Send it to this account: FR76 3000 4000 0312 3456 7890 143"],
    [7, 16500, "I thought this was a dating app?"],
    [2, 16400, "It is! Training together is the best date. Last spots"],
  ],
  "1-14": [
    [14, 28000, "Salut Léa ! Le run club du jeudi, ça te dit ?"],
    [1, 27900, "Carrément, on part d'où ?"],
    [14, 27800, "République, 19h. 8 km tranquille"],
    [1, 27000, "Parfait. Je propose un footing samedi aussi"],
    [14, 2880, "Top, je valide la séance de demain 8h"],
    [1, 2870, "À demain !"],
  ],
  "1-9": [
    [9, 4200, "Hello ! Tu fais du trail aussi ?"],
    [1, 4100, "Un peu, surtout Fontainebleau"],
  ],
};

export function demoMessages(a: string, b: string, mediaUrl: string | null): ChatMessage[] | null {
  const n = (id: string) => (id.startsWith("de000000-") ? Number(id.slice(-12)) : 0);
  const [x, y] = [n(a), n(b)].sort((p, q) => p - q);
  const lines = scripts[`${x}-${y}`];
  if (!lines) return null;
  return lines.map(([who, minutes, text, image], i) => ({
    id: `demo-${x}-${y}-${i}`,
    type: "regular",
    text,
    user: { id: demo(who) },
    created_at: new Date(Date.now() - minutes * 60_000).toISOString(),
    attachments: image && mediaUrl ? [{ type: "image", image_url: `${mediaUrl}/${image}` }] : [],
  }));
}
