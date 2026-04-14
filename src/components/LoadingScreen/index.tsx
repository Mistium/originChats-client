import { h } from "preact";
import { Icon } from "../Icon";

const TIPS = [
  "MistWarp's anniversary is less than a year away! - Nameless",
  "ur gay - Flufi",
  "that is making my braincells consider dying as their next action - JustNoone",
  "OH MY FLIPPERS - roturBOT",
  "Femboys can be not gray - JustNoone",
  "Penguinmod cringe fr fr ong no cap (real) (not gone wrong) (mistwarp better real) - Flufi",
  "Fences are always gray - Nameless",
  "Dont try, dont try to hide it - Flufi",
  "CSS is my passion - Nameless",
  "CSS is a turing complete scripting language - Mistium",
  "I want to be Poland - Andrew",
  "Wear thigh highs or die :3 - Flufi",
  "Grah - Flufi",
  "I am a professional MistWarp user - Nameless",
  "Next person to be confused by this quote is gay - Flufi",
  "Look under there",
  "do not the mistwarp - Flufi",
  "im a femboy - Andrew",
  "if only mistwarp was less mist and more warp - Mistium",
  "i just laughed so hard i died - Flufi",
  "I just laughed so hard that I just laughed so hard - ViMi",
];

function getRandomTip() {
  return TIPS[Math.floor(Math.random() * TIPS.length)];
}

export function LoadingScreen() {
  const tip = getRandomTip();

  return (
    <div className="loading-screen">
      <div className="loading-content">
        <img className="loading-logo" src="/dms.png" alt="originChats" draggable={false} />
        <div className="loading-status">
          <Icon name="Loader" size={16} />
          <span>Loading...</span>
        </div>
      </div>
      <div className="loading-tip">
        <span className="tip-label">TIP: </span>
        {tip}
      </div>
    </div>
  );
}
