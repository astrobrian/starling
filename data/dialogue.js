
window.LINES = {
  d1_window:        { who: "magpie", text: "♪♪ ♪ ♪♪♪", face: "happy", chirps: true, replies: ["?"] },
  d1_window_again:  { who: "magpie", text: "♪ ♪♪!", face: "curious", chirps: true },
  d1_star:          { who: "magpie", text: "A star!", face: "happy" },
  d1_bird:          { who: "magpie", text: "Hello! I am a bird! A pretty bird!", face: "joy", replies: ["Hello, bird!", "?"], explain: "d1_bird_me", whatsThat: true },
  d1_bird_me:       { who: "magpie", text: "Me! Me! I am a bird!", face: "happy" },      // it flaps its wings and points one at itself
  d1_berry:         { who: "magpie", text: "I am so hungry. Can you get me a berry?", face: "hungry" },
  d1_yum:           { who: "magpie", text: "Yum! Thank you!", face: "happy" },
  d1_follow:        { who: "magpie", text: "Follow me! To the tree!", face: "happy" },
  d1_hello_sparrow: { who: "magpie", text: "Look! A bird! Hello, Sparrow!", face: "happy" },
  d1_sparrow:       { who: "sparrow", text: "I am hungry. I can't get a berry.", face: "hungry" },   // the magpie's own hungry face from d1_berry: "Hungry! Like me!"
  d1_like_me:       { who: "magpie", text: "Hungry! Like me!", face: "hungry" },         // it rubs its own tummy
  d1_ouch:          { who: "magpie", text: "Ouch!", face: "sad" },
  d1_eat:           { who: "magpie", text: "Eat, Sparrow! Eat!", face: "joy" },            // while the sparrow pecks the berry
  d1_sparrow_yum:   { who: "sparrow", text: "Yum, yum! Thank you!", face: "happy" },
  d1_friends:       { who: "magpie", text: "You helped Sparrow. You helped me. We are friends now!", face: "happy", replies: ["Thank you, friend!", "Hello!"] },
  d1_friend_again:  { who: "magpie", text: "Friends! You and me!", face: "joy" },
  d1_named:         { who: "magpie", text: "{name}! {name}! I like it!", face: "happy" },
  d1_look_up:       { who: "magpie", text: "Look up!", face: "joy" },                     // every night
  d1_bird_star:     { who: "magpie", text: "And look! A bird star! That one is me!", face: "joy" },   // the bridge's first bird-star
  d1_tomorrow:      { who: "magpie", text: "Tomorrow, more birds! More friends!", face: "happy" },

  good_morning:     { who: "magpie", text: "Hello! I have a new word for you!", face: "happy" },   // at her window, every morning
  come_out:         { who: "magpie", text: "Come out! I am by the door!", face: "happy" },        // then it flies off to wait outside
  sunset:           { who: "magpie", text: "Look at the sun! Good night, sun!", face: "happy" },  // (if she taps the magpie at sunset)
  new_stars:        { who: "magpie", text: "Look! New stars!", face: "happy" },
  new_star:         { who: "magpie", text: "Look! A new star!", face: "happy" },          // (when only one new star came out tonight)
  go_home:          { who: "magpie", text: "Let's go home. Good night! See you at your window!", face: "happy" },  // then it flies off to sleep in its tree
  bedtime:          { who: "magpie", text: "Good night!", face: "joy" },                  // (not said in Chapter 1: the magpie sleeps in its tree)

  head_home:        { who: "magpie", text: "Go home now?", face: "curious", replies: ["Yes!", "Not yet!"] },
  head_home_later:  { who: "magpie", text: "OK! Let's play more!", face: "joy" },
  head_home_follow: { who: "magpie", text: "Let's go home! Follow me!", face: "happy" },
  friends_waiting:  { who: "magpie", text: "Good morning! Let's go see our friends!", face: "happy" },
  porch_night:      { who: "magpie", text: "Good night! See you at your window!", face: "joy" },
  morning_reply:    { who: "her", replies: ["Good morning!"] },

  free_morning:     { who: "magpie", text: "Good morning, friend!", face: "joy" },
  free_day:         { who: "magpie", text: "Let's find more birds!", face: "happy" },

  d2_morning:       { who: "magpie", text: "Good morning!", face: "joy", replies: ["Good morning!"] },
  d2_window:        { who: "magpie", text: "Come to the window! Come, come!", face: "happy" },
  d2_door:          { who: "magpie", text: "Now go to the door! Come out!", face: "happy" },
  d2_house:         { who: "magpie", text: "Look! Your house! I like it!", face: "joy", replies: ["My house!"] },
  d2_lead:          { who: "magpie", text: "Look! Sparrow is in the tree! Follow me!", face: "happy" },
  d2_lost:          { who: "sparrow", text: "Oh no! I lost my feather!", face: "sad" },
  d2_find:          { who: "sparrow", text: "Can you find it? Please?", face: "sad", replies: ["OK!", "?"], explain: "d2_find_this" },
  d2_find_this:     { who: "magpie", text: "The feather! Look! There, by the flowers!", face: "curious" },
  d2_found:         { who: "sparrow", text: "My feather! Thank you, friend!", face: "joy" },
  d2_lead_bulbul:   { who: "magpie", text: "Look! A new bird! Follow me!", face: "happy" },
  d2_lead_bulbul_back: { who: "magpie", text: "Look! Bulbul is back! Follow me!", face: "happy" },   // (its favor picking up after a break, once it's her friend: never "A new bird!" again)
  d2_want:          { who: "bulbul", text: "I am so hungry! I want a plum!", face: "hungry", korean: { want: "먹고 싶어" } },   // in the persimmon tree: the little green persimmons are too hard; thought bubble: a plum
  d2_berry:         { who: "magpie", text: "Hungry? Have a berry!", face: "happy" },
  d2_no_berry:      { who: "bulbul", text: "No, no! I want a plum!", face: "hungry", korean: { want: "먹고 싶어" } },
  d2_bulbul_yum:    { who: "bulbul", text: "Yum! Can I eat one more?", face: "happy" },      // it eats the ripe plum that dropped from the plum tree
  d2_persimmon:     { who: "magpie", text: "Look! My persimmon!", face: "happy" },          // by one little green persimmon in the persimmon tree (it sparkles)
  d2_later:         { who: "magpie", text: "Tap, tap! Not now... later!", face: "happy" },   // it taps the hard green persimmon; thought bubble: the same one big and orange on a bare branch (persimmonLater)
  d2_save:          { who: "magpie", text: "Save one for me!", face: "curious", replies: ["OK!", "?"], explain: "d2_save_this" },   // a promise for the fall: when she picks the persimmons, she leaves this one (까치밥); it starts to glow softly
  d2_save_this:     { who: "magpie", text: "This one! Save it for me!", face: "happy" },
  d2_bulbul_ok:     { who: "bulbul", text: "OK, OK! That one is for you!", face: "happy" },   // the bulbul loves persimmons best of all in winter: it promises too
  d2_night:         { who: "magpie", text: "Look! A persimmon in the stars! Save it for me!", face: "joy" },   // the promise, in the stars

  d3_flower:        { who: "magpie", text: "Good morning! I found a flower for you!", face: "joy", replies: ["Thank you!"] },
  d3_window:        { who: "magpie", text: "For your window! So pretty!", face: "happy" },
  d3_come_out:      { who: "magpie", text: "Come out! I am in my persimmon tree!", face: "happy" },   // by its little green persimmon (glowing: the promise), next to her house
  d3_lead_tit:      { who: "magpie", text: "Look! A little bird! Follow me!", face: "happy" },
  d3_lead_tit_back: { who: "magpie", text: "Look! The feeder is full! Follow me!", face: "happy" },     // (picking the favor up again: the tit is her friend now)
  d3_empty:         { who: "tit", text: "Oh, hello! The feeder is empty!", face: "sad", replies: ["Oh no!", "?"], whatsThat: true },   // the tit pecks at the bare tray
  d3_empty_this:    { who: "magpie", text: "The feeder! Empty! No seeds in it!", face: "curious" },   // after either reply: it stands on the feeder, peers into the tray and shakes its head
  d3_seeds:         { who: "magpie", text: "Seeds! Look! By your house, by the door!", face: "happy" },
  d3_back:          { who: "magpie", text: "Come! Seeds for the feeder!", face: "happy" },   // (only if she taps the magpie on the way back)
  d3_tit_yum:       { who: "tit", text: "It is full! Now we can eat! Thank you so much!", face: "joy" },   // as the birds fly in to eat
  d3_sparrow:       { who: "sparrow", text: "Look! My feather! I lost it. You found it!", face: "joy" },   // her sparrow, at the feeder, fanning its whole tail
  d3_eat:           { who: "magpie", text: "Seeds! Yum! Save one for me!", face: "joy" },   // as it hops in among the birds at the full feeder
  d3_lead_bulbul:   { who: "magpie", text: "Look! Bulbul is back!", face: "curious" },
  d3_bulbul:        { who: "bulbul", text: "Hello! I am hungry again!", face: "hungry" },
  d3_persimmon:     { who: "magpie", text: "Have a berry! Or a plum! But not my persimmon!", face: "happy" },   // its thought bubble: a berry, then a plum; then a "!" and its persimmon, later (persimmonLater)
  d3_want_flowers:  { who: "bulbul", text: "No, no! I want flowers!", face: "hungry" },
  d3_red:           { who: "bulbul", text: "Can you give me a red flower?", face: "curious" },
  d3_yellow:        { who: "bulbul", text: "Yum! Now a yellow one!", face: "happy" },
  d3_pink:          { who: "bulbul", text: "Yum, yum! A pink one, please!", face: "happy" },
  d3_white:         { who: "bulbul", text: "One more! A white one!", face: "hungry" },
  d3_flowers_yum:   { who: "bulbul", text: "Yum! Thank you, friend!", face: "joy" },        // its face is dusted yellow with pollen
  d3_pollen:        { who: "magpie", text: "Hee hee! Your face is yellow!", face: "joy" },
  d3_pollen_like:   { who: "bulbul", text: "Yellow? I like it!", face: "happy" },
  d3_night:         { who: "magpie", text: "Look! A flower in the stars!", face: "joy" },

  d4_hot:           { who: "magpie", text: "Good morning! So hot!", face: "hot", replies: ["So hot!", "?"], explain: "d4_hot_this" },   // panting, beak open
  d4_hot_this:      { who: "magpie", text: "Hot! Look at the sun! My feathers are hot!", face: "hot" },
  d4_red:           { who: "magpie", text: "Hot, hot, hot! My face is red!", face: "hot" },   // it fans itself with a wing (the hot face has a red blush)
  d4_breakfast:     { who: "magpie", text: "Look! Your breakfast! Let's eat outside!", face: "happy" },
  d4_save:          { who: "magpie", text: "Oh! Save that one for me!", face: "hungry" },   // it points its wing at the 약과 on the tray (thought bubble: the 약과)
  d4_share:         { who: "magpie", text: "Look! They are hungry! Can you share?", face: "curious" },
  d4_rice:          { who: "sparrow", text: "Rice, rice! Can you give us rice?", face: "hungry" },
  d4_rice_yum:      { who: "sparrow", text: "Yum! Rice is like little white seeds!", face: "joy" },
  d4_bread:         { who: "dove", text: "Coo... Bread for us? Please?", face: "hungry" },
  d4_sweet:         { who: "magpie", text: "And for me? No berries! Something sweet!", face: "hungry", korean: { sweet: "달콤한 거" } },   // thought bubble: the 약과 she saved
  d4_sweet_yum:     { who: "magpie", text: "Yum! You saved it for me! Sweet, like a plum!", face: "joy" },   // (its own persimmon is still green, and not sweet at all)
  d4_cup:           { who: "magpie", text: "And you? Your cup! Drink!", face: "happy" },
  d4_shared:        { who: "sparrow", text: "Thank you for sharing!", face: "joy" },
  d4_roof:          { who: "magpie", text: "Look up! The doves! On the roof of your house!", face: "happy" },
  d4_doves_hot:     { who: "dove", text: "Coo... So hot...", face: "hot" },             // panting, beak open
  d4_feeder:        { who: "magpie", text: "Hungry? The feeder is full!", face: "happy" },
  d4_water:         { who: "dove", text: "Coo... No... We want water.", face: "hot" },
  d4_lead_bath:     { who: "magpie", text: "Let's find water! Follow me! By the pink birdhouse!", face: "happy" },   // the bird bath stands by it
  d4_empty:         { who: "magpie", text: "Oh no! The bird bath is empty!", face: "hot" },
  d4_can:           { who: "magpie", text: "Look! The watering can! By your door!", face: "happy", korean: { water: "물뿌리개" } },   // "watering" counts as water: this hint is for the can
  d4_full:          { who: "magpie", text: "Water! Now the bird bath is full!", face: "joy" },
  d4_drink:         { who: "dove", text: "Ahh... Now we can drink!", face: "happy" },
  d4_me_too:        { who: "magpie", text: "A bath! Me too!", face: "joy" },
  d4_lost_feather:  { who: "magpie", text: "Oops! I lost a feather! Hee hee!", face: "joy" },   // it shakes itself; a feather floats in the bath (white and black, or blue-green: never all black like the crow's)
  d4_doves_friends: { who: "dove", text: "Coo! Thank you, friend.", face: "joy" },
  d4_night:         { who: "magpie", text: "Look! Little stars! Like yellow flowers!", face: "happy" },

  d5_happy:         { who: "magpie", text: "Good morning! Not so hot now! I am so happy!", face: "joy", replies: ["I am happy too!", "?"], explain: "d5_happy_this" },
  d5_happy_this:    { who: "magpie", text: "Happy! Like this!", face: "joy" },            // a hop, and hearts
  d5_lead:          { who: "magpie", text: "Look! A little bird! Follow me!", face: "happy" },
  d5_lead_back:     { who: "magpie", text: "Look! Our little friends! Follow me!", face: "happy" },     // (picking the party up again: many parrotbills, her friends now)
  d5_small:         { who: "magpie", text: "Oh! So small! Hello, little one!", face: "curious", replies: ["So small!", "?"], explain: "d5_small_this" },
  d5_small_this:    { who: "magpie", text: "Small! A little bird!", face: "happy" },      // it points its wing at the parrotbill
  d5_lost:          { who: "parrotbill", text: "I lost my friends!", face: "sad" },
  d5_bush:          { who: "parrotbill", text: "They are in a bush! Can you find them?", face: "curious" },
  d5_many:          { who: "magpie", text: "Wow! So many birds!", face: "joy" },
  d5_found_us:      { who: "parrotbill", text: "You found us! Thank you, thank you!", face: "joy" },
  d5_sing:          { who: "parrotbill", text: "We want to sing! Sing with us!", face: "joy", replies: ["Let's sing! ♪"] },
  d5_dance:         { who: "parrotbill", text: "Now dance with us!", face: "joy", replies: ["Let's dance!"] },
  d5_jump:          { who: "parrotbill", text: "Jump! Jump!", face: "joy", replies: ["Jump!"] },
  d5_run:           { who: "parrotbill", text: "Run! To the big tree!", face: "joy" },
  d5_big:           { who: "magpie", text: "The tree is so big! And you are so small!", face: "joy" },   // to the parrotbills, under the big tree
  d5_go_tree:       { who: "magpie", text: "Follow me! To the big tree!", face: "happy" },   // (only if she wanders off before the friends gather)
  d5_friends:       { who: "magpie", text: "Look! So many friends! I am so happy!", face: "joy" },
  d5_plum:          { who: "magpie", text: "Look! A plum for all of us!", face: "joy" },     // back from the plum tree with a ripe plum; it sets it down among the friends
  d5_share:         { who: "magpie", text: "You shared with us. Now I share with you!", face: "happy" },
  d5_sweet:         { who: "bulbul", text: "Yum! So sweet! Thank you, {name}! One more?", face: "joy" },   // the greediest says it for all, and asks for one more (as on Day 2)
  d5_later:         { who: "magpie", text: "Hee hee! Later! My persimmon is for all of us!", face: "joy" },   // thought bubble: its persimmon, later (persimmonLater): its promise is for every friend now
  d5_say_hello:     { who: "magpie", text: "Say hello to our friends!", face: "happy" },   // then she greets each kind of friend once
  d5_hi_sparrow:    { who: "sparrow", text: "Hi, friend! Thank you for the rice!", face: "joy" },   // (the first time she taps each friend)
  d5_hi_bulbul:     { who: "bulbul", text: "Hi! You gave me red, yellow, pink and white flowers! Yum!", face: "joy" },
  d5_hi_tit:        { who: "tit", text: "Hello! The feeder is not empty now! It is full of seeds!", face: "happy" },   // it looks at the feeder
  d5_hi_dove:       { who: "dove", text: "Coo... Thank you for the bread. We like the roof of your house.", face: "happy" },
  d5_hi_dove2:      { who: "dove", text: "Coo... We drink water from the bird bath. It is like a big cup!", face: "happy" },   // (the other dove answers)
  d5_hi_parrotbill: { who: "parrotbill", text: "Hee hee! Let's sing again! La la la!", face: "joy" },
  d5_sleep:         { who: "magpie", text: "Shh! They are sleeping!", face: "happy" },
  d5_stars:         { who: "magpie", text: "Look! A star for every friend!", face: "joy" },
  d5_feather:       { who: "magpie", text: "Oh! Look! A feather!", face: "curious" },       // a big black feather comes down on the night wind
  d5_crow:          { who: "magpie", text: "Not my feather! A crow! By the river!", face: "curious" },   // it holds the feather to its own wing, then points its beak at the river (crow needs its entry in data/words.js, with 까마귀)
  d5_tomorrow:      { who: "magpie", text: "Tomorrow, let's find the crow!", face: "happy" },

  d3_river:         { who: "magpie", text: "Let's go to the river!", face: "happy" },
  d3_river_here:    { who: "magpie", text: "The river! So pretty!", face: "joy" },
  d3_where:         { who: "duckling", text: "Where is my mom?", face: "sad" },
  d3_follow:        { who: "magpie", text: "Follow us, little one!", face: "happy" },
  d3_mom:           { who: "hen", text: "Thank you, friend!", face: "happy" },
  d3_lead:          { who: "magpie", text: "Oh! Look! A little bird!", face: "curious" },
  d3_mom_name:      { who: "magpie", text: "Mom!" },               // in the magpie's bubble, when she taps the mom
  d4_morning:       { who: "magpie", text: "Duck! Let's go see the ducks!", face: "happy" },
  d4_ducks_here:    { who: "magpie", text: "Look! Ducks!", face: "joy" },
  d4_hungry:        { who: "drake", text: "We are hungry!", face: "hungry" },
  d4_crackers:      { who: "hen", text: "Do you have crackers?", face: "curious" },
  d4_at_home:       { who: "magpie", text: "I know! At home!", face: "happy" },
  d4_cheer:         { who: "drake", text: "Crackers! Yum!", face: "happy" },
  d4_candy:         { who: "magpie", text: "Candy! Star candy!", face: "happy" },
  d4_back:          { who: "magpie", text: "The ducks! Let's go!", face: "happy" },
  d4_shh:           { who: "heron", text: "Shh. I am fishing.", face: "curious" },
  d4_fish:          { who: "heron", text: "A fish! Thank you for waiting.", face: "happy" },
  d4_lead_heron:    { who: "magpie", text: "Look! Heron is here!", face: "curious" },
  d5_sky:           { who: "magpie", text: "Look at the sky! So blue!", face: "happy" },
  d5_sky_up:        { who: "magpie", text: "Look up! The sky!", face: "joy" },
  d5_hide:          { who: "grebe", text: "I hide in the water. Find me!", face: "happy" },
  d5_giggle:        { who: "grebe", text: "Hee hee!", face: "happy" },
  d5_again:         { who: "grebe", text: "Again! Find me!", face: "happy" },
  d5_done:          { who: "grebe", text: "Hee hee! Thank you, friend!", face: "happy" },
};

window.FRAME_LINES = {
  friendsWaiting: "friends_waiting",   // at her window, on a morning that goes on with yesterday's favors
  morningReply: "morning_reply",       // her answers when he says good morning (its replies)
  freeMorning: "free_morning",         // at her window, on a free day (after the last day that's written)
  freeDay: "free_day",                 // what the magpie says again on a free day, when she taps it
  headHome: "head_home",               // "Go home now?" after the day's favors (its first reply starts the evening)
  headHomeLater: "head_home_later",    // her other reply ("Not yet!"): "OK! Let's play more!"
  headHomeFollow: "head_home_follow",  // after "Yes!", as it flies ahead toward her house
  sunset: "sunset",                    // what it says again on the way home, when she taps it
  lookUp: "d1_look_up",                // "Look up!" on the porch (a day's night can have its own: lookUp)
  newStars: "new_stars",               // once tonight's new stars are out ("new_stars" in a night's lines means this)
  newStar: "new_star",                 // the same, when only one new star came out tonight
  porchNight: "porch_night",           // after the stars, before it flies off to roost in the big tree
};

window.MAGPIE_NAMES = ["Kkachi", "Bori", "Dubu", "Mochi"];
