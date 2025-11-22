(function(){

  const THEMES = {
  1: { // Makar Sankranti
    name:"Makar Sankranti",
    text:"Fly the Kites!",
    emoji:"🪁",
    primary:"#0B8E4E",
    secondary:"#FFD86B",
    bg:"#F2FFEA",
    card:"#FFFFFF",
    sidebar:"#E8FBDD",
    border:"rgba(11,142,78,0.25)",
    banner:"url('/assets/makar_sankranti.jpg')"
  },

  2: { // Mahashivratri
    name:"Mahashivratri",
    text:"Har Har Mahadev",
    emoji:"🕉️",
    primary:"#1C174A",
    secondary:"#BFA5FF",
    bg:"#ECE8FF",
    card:"#FFFFFF",
    sidebar:"#E3DCFF",
    border:"rgba(28,23,74,0.25)",
    banner:"url('/assets/shivratri.jpg')"
  },

  3: { // Holi
    name:"Holi",
    text:"Rangon Ka Tyohaar!",
    emoji:"🌈",
    primary:"#FF4F70",
    secondary:"#FFD645",
    bg:"#FFF2F7",
    card:"#FFFFFF",
    sidebar:"#FFE6F0",
    border:"rgba(255,79,112,0.25)",
    banner:"url('/assets/holi.jpg')"
  },

  4: { // Chaitra Navratri
    name:"Chaitra Navratri",
    text:"Jai Mata Di",
    emoji:"🙏",
    primary:"#7C3AED",
    secondary:"#FF7B9E",
    bg:"#F5EDFF",
    card:"#FFFFFF",
    sidebar:"#FBE9F2",
    border:"rgba(124,58,237,0.28)",
    banner:"url('/assets/navratri.jpg')"
  },

  5: { // Akshay Tritiya
    name:"Akshay Tritiya",
    text:"Prosperity & Blessings",
    emoji:"💰",
    primary:"#F5B400",
    secondary:"#00C389",
    bg:"#FFF9E6",
    card:"#FFFFFF",
    sidebar:"#FFF2C9",
    border:"rgba(245,180,0,0.28)",
    banner:"url('/assets/akshay_tritiya.jpg')"
  },

  6: { // Nirjala Ekadashi
    name:"Nirjala Ekadashi",
    text:"Devotion & Dharma",
    emoji:"🪔",
    primary:"#0284C7",
    secondary:"#82DDFF",
    bg:"#E6F7FF",
    card:"#FFFFFF",
    sidebar:"#DAF4FF",
    border:"rgba(2,132,199,0.28)",
    banner:"url('/assets/ekadashi.jpg')"
  },

  7: { // Guru Purnima
    name:"Guru Purnima",
    text:"Gratitude to Gurus",
    emoji:"🌕",
    primary:"#5A21B8",
    secondary:"#FF8D3A",
    bg:"#F3E9FF",
    card:"#FFFFFF",
    sidebar:"#EEDCFF",
    border:"rgba(90,33,184,0.25)",
    banner:"url('/assets/guru_purnima.jpg')"
  },

  8: { // Krishna Janmashtami
    name:"Krishna Janmashtami",
    text:"Hare Krishna",
    emoji:"🎻",
    primary:"#089AA0",
    secondary:"#03C2E2",
    bg:"#E8FFFC",
    card:"#FFFFFF",
    sidebar:"#D3F8F4",
    border:"rgba(8,154,160,0.25)",
    banner:"url('/assets/janmashtami.jpg')"
  },

  9: { // Ganesh Chaturthi
    name:"Ganesh Chaturthi",
    text:"Bappa Moriya!",
    emoji:"🐘",
    primary:"#D98400",
    secondary:"#F24F4F",
    bg:"#FFF4E6",
    card:"#FFFFFF",
    sidebar:"#FFE8CE",
    border:"rgba(217,132,0,0.25)",
    banner:"url('/assets/ganesh.jpg')"
  },

  10:{ // Navdurga + Dussehra
    name:"Navdurga & Dussehra",
    text:"Victory of Good",
    emoji:"🔱",
    primary:"#C32828",
    secondary:"#FF8C39",
    bg:"#FFE7E7",
    card:"#FFFFFF",
    sidebar:"#FFE0D4",
    border:"rgba(195,40,40,0.25)",
    banner:"url('/assets/dussehra.jpg')"
  },

  11:{ // Diwali
    name:"Diwali",
    text:"Festival of Lights",
    // emoji:"🪔",
    primary:"#FF9800",
    secondary:"#FFE299",
    bg:"#FFF7E6",
    card:"#FFFFFF",
    sidebar:"#FFEDC8",
    border:"rgba(255,152,0,0.3)",
    banner:"url('/assets/diwali.jpg')"
  },

  12:{ // Gita Jayanti
    name:"Gita Jayanti",
    text:"Wisdom & Knowledge",
    emoji:"📜",
    primary:"#0F1A36",
    secondary:"#FBC02D",
    bg:"#EDF1FF",
    card:"#FFFFFF",
    sidebar:"#E0E6FF",
    border:"rgba(15,26,54,0.25)",
    banner:"url('/assets/gita.jpg')"
  }
}


  function applyTheme(th){
    const root = document.documentElement;

    root.style.setProperty("--fest-primary", th.primary);
    root.style.setProperty("--fest-secondary", th.secondary);
    root.style.setProperty("--fest-bg", th.bg);
    root.style.setProperty("--fest-card", th.card);
    root.style.setProperty("--fest-sidebar-bg", th.sidebar);
    root.style.setProperty("--fest-text", "#111");
    root.style.setProperty("--fest-border", th.border);
    root.style.setProperty("--fest-nav-start", th.primary);
    root.style.setProperty("--fest-nav-end", th.secondary);


    root.style.setProperty("--fest-banner-bg", th.banner);

    document.getElementById("festivalName").textContent = th.text;
    document.getElementById("festivalDates").textContent = th.name;

    let emojiEl = document.querySelector(".banner-emoji");
    if (!emojiEl) {
      emojiEl = document.createElement("div");
      emojiEl.className = "banner-emoji";
      document.getElementById("themeBanner").appendChild(emojiEl);
    }
    emojiEl.textContent = th.emoji;
  }

  function applyDefault(){
    const root = document.documentElement;

    root.style.setProperty("--fest-primary", "#1e293b");
    root.style.setProperty("--fest-secondary", "#60a5fa");
    root.style.setProperty("--fest-bg", "#f5f5f5");
    root.style.setProperty("--fest-card", "#ffffff");
    root.style.setProperty("--fest-sidebar-bg", "#ffffff");
    root.style.setProperty("--fest-border", "rgba(0,0,0,0.15)");
    root.style.setProperty("--fest-banner-bg", "none");
    root.style.setProperty("--fest-nav-start", th.primary);
    root.style.setProperty("--fest-nav-end", th.secondary);


    document.getElementById("festivalName").textContent = "Welcome to Campus Buzz";
    document.getElementById("festivalDates").textContent = "Connect, Share, and Engage";

    const emoji = document.querySelector(".banner-emoji");
    if (emoji) emoji.remove();
  }

  function initTheme(){
    const now = new Date();
    const m = now.getMonth() + 1;
    const d = now.getDate();

    if(d >= 1 && d <= 20 && THEMES[m]){
      applyTheme(THEMES[m]);
    } else {
      applyDefault();
    }
  }

  document.addEventListener("DOMContentLoaded", initTheme);

})();
