
window.UI_TEXT = {
  title: "Starling",
  tapToStart: "Tap to start",
  continueDay: "Continue: Day {day}",
  newGame: "New game",
  newGameAsk: "Start a new game from Day 1?",     // New game asks twice before erasing anything
  newGameYes: "Yes",
  newGameSure: "Your stars and friends will be gone.\nAre you sure?",     // (\n: a new line)
  newGameSureYes: "Yes, start again",
  no: "No",
  story: "Story",
  credits: "Credits",
  madeByFor: "Made with love by {by} for {for}.",
  madeWithLove: "Made with love.",                // until DEDICATION (below) has the names
  thanks: "Thank you for playing!",
  learnedOn: "Day {day}",
  learnedWith: "Day {day}, with {who}",
  notYet: "Not yet",                  // a star still to come (a word she hasn't learned)
  cardComplete: "✦ All its stars are out! ✦",      // a constellation's card, when she knows all its words
  backupRow: "Backup",
  backupSave: "Save",
  backupSaveKorean: "저장",
  backupLoad: "Load",
  backupLoadKorean: "불러오기",
  backupSaveTitle: "Your backup",
  backupSaveTitleKorean: "백업 코드",
  backupSaveHelp: "Keep this code in Notes, or send it to yourself.",
  backupSaveHelpKorean: "메모에 저장하거나, 나에게 보내 두세요.",
  backupCopied: "The code is copied. Paste it in Notes.",
  backupLoadTitle: "Load a backup",
  backupLoadTitleKorean: "백업 불러오기",
  backupLoadHelp: "Paste your backup code here.",
  backupLoadHelpKorean: "백업 코드를 여기에 붙여 넣으세요.",
  backupLoadGo: "Load",
  backupCopiedKorean: "코드를 복사했어요. 메모에 붙여 넣으세요.",
  backupEmpty: "Paste your code first.",
  backupEmptyKorean: "먼저 코드를 붙여 넣으세요.",
  backupBad: "Some of the code is missing. Copy all of it, from STARLING to the end.",
  backupBadKorean: "코드가 일부 빠졌어요. STARLING부터 끝까지 모두 복사하세요.",
  backupSure: "Load this backup?",
  backupSureKorean: "지금 진행이 이 백업으로 바뀌어요.",
  backupThis: "This backup",
  backupNow: "Now",
  backupDay: "Day {day}",
  backupOlder: "This backup has fewer stars than now.\nLoad it anyway?",
  backupOlderKorean: "이 백업은 지금보다 별이 적어요. 그래도 불러올까요?",
  backupBefore: "Before",
  whatsThat: "What's that?",
  backupYes: "Yes, load it",
  backupBack: "Back",
  backupNo: "No",
  backupUndo: "Bring back Day {day}, {stars} stars",
  backupUndoKorean: "되돌리기",
  backupUndoSure: "Go back to Day {day}, {stars} stars?",
  backupUndoSureKorean: "예전 진행으로 돌아갈까요?",
  backupOffer: "Save a backup of your stars?",
  backupOfferKorean: "별 백업을 저장할까요?",
  backupOfferYes: "Save a backup",
  backupNotNow: "Not now",
  diary: "Diary",                    // the menu button
  diaryTitle: "My diary",
  diaryTitleKorean: "그림일기",
  goodNight: "Good night",           // closes the page at bedtime
  diaryClose: "Close",
  diaryDay: "Day {day}",
  lunarDate: "음력 {month}월 {day}일",
  diaryEmpty: "No pages yet.",       // her diary before her first night
  diaryEmptyKorean: "오늘 밤 자기 전에 첫 그림일기를 써요.",
  diaryBack: "Back a page",          // (for screen readers: the ‹ and › buttons)
  diaryNext: "Next page",
  weather: { sunny: "sunny", hot: "hot", cloudy: "cloudy", rainy: "rainy" },
  menu: "Menu",
  resume: "Resume",
  titleScreen: "Title screen",
  settings: "Settings",
  music: "Music",
  sounds: "Sounds",
  done: "Done",
  zoom: "Zoom",
  zoom_close: "Close",
  zoom_normal: "Normal",
  zoom_far: "Far",
  zoom_wide: "Wide",
  callHusband: "Call husband",   // the side button: the magpie fetches him
  byeForNow: "Bye for now",      // the same button while he's with her
  visitHusband: "Visit husband", // the second side button: off to the observatory
  goHome: "Go home",             // the same button at the observatory
  bee: "Bzz!",          // bees only ever say this
  day: "Day",           // the card each morning: "Day 2"
  theEnd: "Starling",   // the title card after the first night, and after Day 5
  moreDays: "More days are coming soon!",
  toBeContinued: "To be continued...",   // the card at the end of a chapter (after "Starling"), with moreDays under it
  sleepAsk: "Go to sleep?",
  sleepYes: "Yes",
  sleepNo: "Not yet",
  skipEvening: "Skip",       // in the evening, from "I'm home!" on: straight to bed
  version: "Version",
  credit: "Piano: Noct-Salamander Grand Piano by Chisato Yamauchi, from the Salamander Grand Piano by Alexander Holm (CC BY 3.0).",
};

window.DEDICATION = {
  by: "",      // your name
  for: "",     // hers
  forKorean: "",   // hers in Korean letters, for the intro's Korean line (left empty, it uses "for"); then run python3 tools/subset_fonts.py
};
