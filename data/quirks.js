
window.QUIRKS = {
  firstAfter: [60, 110],
  between: [130, 200],
  sitFor: 5,
  stillFor: 1.2,
  quirks: {
    whatsThat:    { cooldown: 0 },
    shoulder:     { odds: 0.15, cooldown: 420 },           // she rests her head on his shoulder
    lap:          { odds: 0.12, cooldown: 480 },           // he lies down with his head on her lap
    doze:         { odds: 0.12, cooldown: 480 },           // he dozes off ("Zzz"), and the magpie lands on his head
    swing:        { odds: 0.1, cooldown: 360 },            // they swing their joined hands
    flower:       { odds: 0.25, cooldown: 900, perDay: 1 }, // (in the flowers) he tucks a flower behind her ear
    lift:         { odds: 0.35, cooldown: 600 },           // (at the persimmon tree) he lifts her up to reach
    stones:       { odds: 0.3, cooldown: 420 },            // (by the quiet bend of the river) he skips a stone
    pat:          { odds: 0.04, cooldown: 600 },           // he pats her head
    leaf:         { odds: 0.12, cooldown: 600 },           // (under a tree) a leaf lands in her hair, and he picks it off
    shootingStar: { odds: 0.3, cooldown: 300 },            // (on the observatory hill, at night) he points out a shooting star, and she makes a wish
  },
  says: {
    flower: "For you!",
    leaf: "A leaf!",
    shootingStar: "Look! Make a wish!",
    lift: "",
    stones: "",
  },
  numbers: ["one", "two", "three"],
};
