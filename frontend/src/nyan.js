import { sfx } from "./sfx";
// Пиксельный Nyan Cat, рисуется прямоугольниками
const RAINBOW = ["#FF0000", "#FF9900", "#FFFF00", "#33FF00", "#0099FF", "#6633FF"];
const COL = { K: "#000000", G: "#999999", T: "#FFCC99", P: "#FF99FF", S: "#FF3399", H: "#FF9999" };
const HEAD = [
  "K.....K",
  "KKKKKKK",
  "KGGGGGK",
  "KGKGKGK",
  "KHGGGHK",
  "KGGKGGK",
  "KKKKKKK",
];
// Кот в сетке 13x12 клеток, клетка = 2px
export const NYAN_W = 26;
export const NYAN_H = 24;

// Радужный хвост. x, y — левый верх кота
export function drawNyanTrail(ctx, x, y, frame, u = 2) {
  x = Math.round(x);
  y = Math.round(y);
  for (let i = 0; i < 6; i++) {
    const sx = x + 2 * u - (i + 1) * 3 * u;
    const off = (i + frame) % 2 ? u : 0; // волна
    for (let k = 0; k < 6; k++) {
      ctx.fillStyle = RAINBOW[k];
      ctx.fillRect(sx, y + (3 + k) * u + off, 3 * u, u);
    }
  }
}

export function drawNyanCat(ctx, x, y, frame, air = false, u = 2) {
  x = Math.round(x);
  y = Math.round(y);
  const r = (cx, cy, w, h, c) => {
    ctx.fillStyle = COL[c];
    ctx.fillRect(x + cx * u, y + cy * u, w * u, h * u);
  };
  const wag = frame % 2;

  // хвост
  r(0, 5 + wag, 1, 3, "K");
  r(0, 6 + wag, 1, 1, "G");
  // лапы (в прыжке вытянуты)
  for (const [cx, ph] of [[1, 0], [4, 1], [8, 0], [11, 1]]) {
    const h = air || (frame + ph) % 2 ? 2 : 1;
    r(cx, 12 - h, 2, h, "G");
  }
  // поп-тарт
  r(1, 2, 9, 8, "K");
  r(2, 3, 7, 6, "T");
  r(3, 4, 5, 4, "P");
  r(4, 5, 1, 1, "S"); r(6, 4, 1, 1, "S"); r(6, 7, 1, 1, "S"); r(3, 7, 1, 1, "S");
  // голова
  r(8, 1, 1, 1, "K"); r(12, 1, 1, 1, "K"); // уши
  r(8, 2, 5, 8, "K");
  r(9, 3, 3, 6, "G");
  r(9, 4, 1, 1, "K"); r(11, 4, 1, 1, "K"); // глаза
  r(9, 6, 1, 1, "H"); r(11, 6, 1, 1, "H"); // щёки
  r(10, 6, 1, 1, "K"); // рот
}

// Звёзды на фоне, медленно уплывают влево
export function drawStars(ctx, W, maxY, t, color = "#FFFFAA") {
  ctx.fillStyle = color;
  for (let i = 0; i < 16; i++) {
    const sp = 12 + (i % 3) * 10;
    const x = (((i * 97 - t * sp) % W) + W) % W;
    const y = ((i * 53) % (maxY - 10)) + 4;
    const sz = i % 4 === 0 ? 2 : 1;
    ctx.fillRect(Math.round(x), y, sz, sz);
  }
}
export function drawNyanHead(ctx, cx, cy, u = 2) {
  const x0 = Math.round(cx - 3.5 * u);
  const y0 = Math.round(cy - 3.5 * u);
  HEAD.forEach((row, j) => {
    for (let i = 0; i < 7; i++) {
      const c = row[i];
      if (c === ".") continue;
      ctx.fillStyle = COL[c];
      ctx.fillRect(x0 + i * u, y0 + j * u, u, u);
    }
  });
}