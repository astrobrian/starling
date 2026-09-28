
window.HILL_MAP = [
  "ssssssssssssssssssssssssssss",
  "ssssssssssssssssssssssssssss",
  "ssssssssssssssssssssssssssss",
  "ssssssssssssssssssssssssssss",
  "sssssssss,,,,,,,,,,sssssssss",
  "ssssss,,,,,,,,,,,,,,,,ssssss",
  "ssss,,,,,,,,,,,,,,,,,,,,ssss",
  "ss,,,,,,,,,,,,,,,,,,,,,,,,ss",
  "s,,,,,,,,,,,,,D,,,,,,,,,,,,s",
  ",,,,,,,,,,,,,,p,,,,,,,,,,,,,",
  ",,,,,,,,,,,,,,A,,,,,,,,,,,,,",
  ",,,,,,,,,,,,,,,,,,,,,,,,,,,,",
  ",,,,,,,,,,,,,,,,,,,,,,,,,,,,",
];

window.DOME_MAP = [
  "###############",
  "###wwwwwwwww###",
  "##wwwwwwwwwww##",
  "#wwwwwwwwwwwww#",
  "#.............#",
  "#.............#",
  "#.............#",
  "#.............#",
  "##...........##",
  "###.........###",
  "#######D#######",
];

window.OBSERVATORY_THINGS = {
  observatory:  { name: "observatory", korean: "천문대", size: [5, 2], blocks: true },
  lampPost:     { name: "lamp",        size: [1, 1], blocks: true },
  bench:        { name: "bench",       size: [2, 1], blocks: true },
  rock:         { name: "rock",        size: [1, 1], blocks: true },
  bush:         { name: "bush",        size: [1, 1], blocks: true },
  bigTelescope: { name: "telescope",   korean: "망원경", size: [3, 2], blocks: true },
  workDesk:     { name: "desk",        size: [2, 1], blocks: true },
  chair:        { name: "chair",       size: [1, 1], blocks: true },
  whiteboard:   { name: "whiteboard",  size: [3, 1], blocks: true, onWall: true },
  starChart:    { name: "star map",    korean: "별자리 지도", size: [2, 1], blocks: true, onWall: true },
  redLamp:      { name: "red light",   size: [1, 1], blocks: true },
  bookcase:     { name: "books",       size: [1, 1], blocks: true },
};

window.HILL_OBJECTS = [
  { type: "observatory", x: 12, y: 6 },
  { type: "lampPost", x: 16, y: 8 },
  { type: "bench", x: 18, y: 9 },
  { type: "bush", x: 6, y: 7, variant: 1 },
  { type: "bush", x: 21, y: 7, variant: 2 },
  { type: "rock", x: 4, y: 9 },
  { type: "rock", x: 23, y: 10, variant: 1 },
  { type: "bush", x: 9, y: 10, variant: 0 },
];

window.DOME_OBJECTS = [
  { type: "starChart", x: 2, y: 3 },
  { type: "whiteboard", x: 10, y: 3 },
  { type: "workDesk", x: 1, y: 4 },
  { type: "chair", x: 2, y: 5 },
  { type: "bookcase", x: 13, y: 4 },
  { type: "bigTelescope", x: 6, y: 5 },
  { type: "redLamp", x: 1, y: 7 },
  { type: "redLamp", x: 13, y: 7 },
];

window.HUSBAND_POST = { x: 5, y: 7 };

window.OBSERVATORY_TEXT = {
  welcome: ["Welcome to my observatory!", "Hello! Look at the stars with me!"],
  look: "Look through the telescope!",     // when she comes in
  stars: "Look! Your stars!",              // when she looks through it
  noStars: "Learn a word. Get a star!",    // ...before she has learned any words
};
