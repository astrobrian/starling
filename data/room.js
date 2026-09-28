
window.ROOM_MAP = [
  "############",
  "#wwwwwwwwww#",
  "#wwwwwwwwww#",
  "#..........#",
  "#....S.....#",
  "#..........#",
  "#..........#",
  "#..........#",
  "#####D######",
];

window.ROOM_THINGS = {
  bed:        { name: "bed",      size: [3, 2], blocks: true },     // a bed for two
  nightstand: { name: "lamp",     size: [1, 1], blocks: true },
  desk:       { name: "desk",     size: [2, 1], blocks: true },
  chair:      { name: "chair",    size: [1, 1], blocks: true },
  crackers:   { name: "crackers", size: [1, 1], blocks: false, korean: "건빵", onDesk: true },
  breakfast:  { name: "breakfast", size: [2, 1], blocks: false, korean: "아침밥", onDesk: true },
  bookcase:   { name: "books",    size: [1, 1], blocks: true },
  plant:      { name: "plant",    size: [1, 1], blocks: true },
  rug:        { name: "rug",      size: [3, 2], blocks: false, flat: true },
  doormat:    { name: "door",     size: [1, 1], blocks: false, flat: true },
  window:     { name: "window",   size: [2, 1], blocks: true, onWall: true },
  picture:    { name: "picture",  size: [1, 1], blocks: true, onWall: true },
  dollBench:  { name: null,       size: [3, 1], blocks: true },
};

window.ROOM_OBJECTS = [
  { type: "window", x: 4, y: 2 },
  { type: "picture", x: 7, y: 2 },
  { type: "nightstand", x: 1, y: 3 },
  { type: "bed", x: 2, y: 3 },
  { type: "dollBench", x: 5, y: 3 },
  { type: "desk", x: 8, y: 3 },
  { type: "crackers", x: 9, y: 3 },
  { type: "chair", x: 8, y: 4 },
  { type: "bookcase", x: 10, y: 3 },
  { type: "plant", x: 1, y: 7 },
  { type: "rug", x: 4, y: 5 },
  { type: "doormat", x: 5, y: 7 },
];

window.ROOM_EXTRAS = {
  breakfast: { type: "breakfast", x: 8, y: 3, variant: 16 },
};
