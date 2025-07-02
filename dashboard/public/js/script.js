const commandsData = {
    category3: {
    icon: "👤",
    title: "User",
    commands: [
      {
        name: "/user register",
        description: "Register your Discord account using a license key.",
        permission: "User",
        options: [
          { name: "key", description: "License key.", required: true },
        ]
      },
      {
        name: "/user info",
        description: "View your user information.",
        permission: "User",
        options: []
      },
      {
        name: "/user change-license",
        description: "Change your existing license key.",
        permission: "User",
        options: [
          { name: "key", description: "Your new license key.", required: true },
        ]
      }
    ],
  },
  category2: {
    icon: "⚡",
    title: "Boost",
    commands: [
      {
        name: "/boost add",
        description: "Add a new Steam account to boost.",
        permission: "User",
        options: [
          { name: "username", description: "Steam username of the account you're adding.", required: true },
          { name: "password", description: "Steam password of the account you're adding.", required: true },
          { name: "shared_secret", description: "Steam password of the account you're adding.", required: false }
        ]
      },
      {
        name: "/boost list",
        description: "List all available Steam accounts.",
        permission: "User",
        options: []
      },
      {
        name: "/boost restart",
        description: "Restart all accounts that are boosting (Include username to restart a specific account).",
        permission: "User",
        options: [
          { name: "username", description: "Steam username of the account you're restarting.", required: false }
        ]
      },
      {
        name: "/boost start",
        description: "Start boosting on a specific Steam account.",
        permission: "User",
        options: [
          { name: "username", description: "Steam username of the account you're starting.", required: true }
        ]
      },
      {
        name: "/boost stop",
        description: "Stop boosting on a specific Steam account.",
        permission: "User",
        options: [
          { name: "username", description: "Steam username of the account you're stopping.", required: true }
        ]
      },
      {
        name: "/boost remove",
        description: "Remove a Steam account from our database.",
        permission: "User",
        options: [
          { name: "username", description: "Steam username of the account you're removing.", required: true }
        ]
      },
      {
        name: "/boost steam-guard",
        description: "Set Steam Guard code for a specific Steam account.",
        permission: "User",
        options: [
          { name: "username", description: "Steam username of the account you're removing.", required: true },
          { name: "code", description: "Steam Guard code.", required: true }

        ]
      }
    ],
  },
  category1: {
    icon: "⚙️",
    title: "Configuration",
    commands: [
      {
        name: "/config games",
        description: "Configure the games to boost on a specific steam account.",
        permission: "User",
        options: [
          { name: "username", description: "Steam username of the account you're changing.", required: true },
          { name: "games", description: "Separate multiple App IDs", required: true }
        ]

      },
      {
        name: "/config online-status",
        description: "Configure the online status for a specific steam account, this will show or hide your account from boosting on steam.",
        permission: "User",
        options: [
          { name: "username", description: "Steam username of account you're changing.", required: true },
          { name: "online", description: "Boolean, true or false.", required: true }
        ]
      },
      {
        name: "/config shared-secret",
        description: "Configure the shared secret for a specifc steam account to be used for Steam Gaurd Authentication.",
        permission: "User",
        options: [
          { name: "username", description: "Steam username of account you're changing.", required: true },
          { name: "shared_secret", description: "Your steam shared secret.", required: true }
        ]
      },
    ],
  },
};

const gamesSimultaneous = 30;
let secondsOpen = 0;
let selectedTimeframe = 'realtime';

const timeframes = {
  realtime: () => secondsOpen,
  '24h': () => 24 * 60 * 60,
  '1w': () => 7 * 24 * 60 * 60,
  '31d': () => 31 * 24 * 60 * 60,
  '1y': () => 365 * 24 * 60 * 60
};

function updateHourDisplay() {
  const seconds = timeframes[selectedTimeframe]();
  const hoursGained = (seconds / 3600) * gamesSimultaneous;
  const perGame = hoursGained / gamesSimultaneous;

  const formattedSeconds = seconds.toLocaleString();
  const formattedHours = selectedTimeframe === 'realtime'
    ? hoursGained.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })
    : Math.floor(hoursGained).toLocaleString(); // no decimals

  const formattedPerGame = selectedTimeframe === 'realtime'
    ? perGame.toLocaleString(undefined, { minimumFractionDigits: 5, maximumFractionDigits: 5 })
    : Math.floor(perGame).toLocaleString(); // no decimals for static views

  // Build the dynamic top section
  const rangeLabel = selectedTimeframe === 'realtime'
    ? `This website has been open for <span class="highlight" id="range-text">${formattedSeconds} seconds</span><br />you could have gained <span class="highlight" id="hours-detail">${formattedHours}</span> hours`
    : `In <span class="highlight" id="range-text">${formatLabel(selectedTimeframe)}</span><br />you could have gained <span class="highlight" id="hours-detail">${formattedHours}</span> hours`;

  // Also update hidden label
  document.getElementById("timeframe-label").textContent =
    selectedTimeframe === "realtime"
      ? `${formattedSeconds} seconds passed`
      : `in ${formatLabel(selectedTimeframe)}`;

  // Inject live content block
  document.querySelector("#range-text").parentElement.innerHTML = rangeLabel;

  // Update large total & per-game value
  document.getElementById("total-hours").textContent = formattedHours;
  document.getElementById("per-game").textContent = `${formattedPerGame} hours`;
  document.getElementById("games-count").textContent = gamesSimultaneous.toLocaleString();

}




function setTimeframe(frame, button) {
  selectedTimeframe = frame;
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.classList.remove("text-white", "border-red-500");
    btn.classList.add("text-white/60");
  });
  button.classList.add("text-white", "border-red-500");
  button.classList.remove("text-white/60");
  updateHourDisplay();
}

function formatLabel(key) {
  switch (key) {
    case '24h': return '24 hours';
    case '1w': return '1 week';
    case '31d': return '31 days';
    case '1y': return '1 year';
    default: return `${secondsOpen} seconds`;
  }
}

setInterval(() => {
  if (selectedTimeframe === 'realtime') secondsOpen++;
  updateHourDisplay();
}, 1000);

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".tab-btn")[0].click(); // activate first tab
});


function createCategoryButton(key, category) {
  return `
    <div class="feature-card p-10 rounded-3xl shadow-xl backdrop-blur-xl border border-white/10 relative overflow-hidden" id="${key}-container">
      <button class="w-full flex items-center gap-6 text-left" onclick="toggleCategory('${key}')">
        <div class="w-12 h-12 gradient-bg rounded-lg flex items-center justify-center shrink-0">
          ${category.icon}
        </div>
        <div class="flex-1">
          <div class="text-2xl sm:text-3xl font-bold text-white">
            ${category.title}
          </div>
        </div>
        <svg class="w-6 h-6 transform transition-transform" id="${key}-arrow"
             xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
        </svg>
      </button>
      <div class="hidden px-2 sm:px-8 pb-6 space-y-4" id="${key}-commands">
        <!-- Commands will be loaded here when category is opened -->
      </div>
    </div>
  `;
}


function createCommandHTML(cmd) {
  const hasOptions = Array.isArray(cmd.options) && cmd.options.length > 0;

  const optionsHTML = hasOptions
    ? `
      <div class="mt-6">
        <p class="text-sm text-white/60 mb-3 font-semibold">Command Options</p>
        <div class="flex flex-wrap gap-3">
          ${cmd.options.map(opt => {
            const label = typeof opt === "string" ? opt : opt.name;
            const isRequired = opt.required === true;
            const description = typeof opt !== "string" && opt.description
              ? `<div class="absolute hidden group-hover:flex flex-col items-center bottom-full left-1/2 transform -translate-x-1/2 mb-2 z-50">
                   <div class="tooltip-box bg-black/90 text-white text-xs border border-white/10 px-2 py-1 rounded-md shadow-md max-w-[240px] text-center">
                     ${opt.description}
                   </div>
                   <div class="w-2 h-2 rotate-45 mt-[-4px] bg-black/90 border-l border-t border-white/10"></div>
                 </div>`
              : "";

            return `
              <div class="relative group">
                <span class="text-xs bg-red-500/10 border border-red-500/30 px-2 py-1 rounded-md text-white/80 cursor-help flex items-center gap-2 hover:bg-red-500/20 transition">
                  ${label}
                  <span class="text-[10px] px-1.5 py-0.5 rounded-md ${
                    isRequired
                      ? 'bg-red-600/40 text-red-100'
                      : 'bg-white/10 text-white/50 border border-white/10'
                  }">
                    ${isRequired ? 'Required' : 'Optional'}
                  </span>
                </span>
                ${description}
              </div>
            `;
          }).join("")}
        </div>
      </div>
    `
    : "";

  return `
    <div class="command-card bg-red-500/5 mt-6 p-6 rounded-2xl border border-red-500/20 hover:bg-red-500/10 transition duration-300">
      <div class="flex justify-between items-start flex-wrap gap-4">
        <div class="flex-1 min-w-[220px]">
          <h4 class="text-2xl font-bold text-white mb-1">${cmd.name}</h4>
          <p class="text-white/70 text-sm leading-relaxed">${cmd.description}</p>
          ${optionsHTML}
        </div>
        <div>
          <span class="inline-block px-3 py-1 bg-red-600/30 text-white border border-red-400/30 rounded-lg text-xs font-semibold">
            ${cmd.permission}
          </span>
        </div>
      </div>
    </div>
  `;
}











const loadedCategories = new Set();

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    const loader = document.getElementById("loader");
    if (loader) {
      loader.style.opacity = "0";
      setTimeout(() => loader.remove(), 500);
    }
  }, 1000);
});

gsap.registerPlugin(ScrollTrigger);
gsap.from("#hero-heading", {
  opacity: 0,
  y: 50,
  duration: 1.5,
  delay: 0.5,
  ease: "power4.out",
});

gsap.from("#hero-subheading", {
  opacity: 0,
  y: 30,
  duration: 1.2,
  delay: 0.7,
  ease: "power4.out",
});

gsap.from("#hero-button1", {
  opacity: 0,
  y: 20,
  duration: 1,
  delay: 1,
  ease: "power4.out",
});

gsap.from("#hero-button2", {
  opacity: 0,
  y: 20,
  duration: 1,
  delay: 1.2,
  ease: "power4.out",
});

gsap.from("#hero-logo", {
  opacity: 0,
  scale: 0.8,
  duration: 1.5,
  delay: 0.5,
  ease: "power4.out",
});

function initHeroAnimations() {
  const timeline = gsap.timeline({ defaults: { ease: "power3.out" } });

  timeline
    .from("#hero h1", {
      opacity: 0,
      y: 100,
      duration: 1,
    })
    .from(
      "#hero p",
      {
        opacity: 0,
        y: 50,
        duration: 0.8,
      },
      "-=0.5",
    )
    .from(
      "#hero button",
      {
        opacity: 0,
        y: 50,
        duration: 0.8,
        stagger: 0.2,
      },
      "-=0.5",
    )
    .from(
      "#hero img",
      {
        opacity: 0,
        x: 100,
        duration: 1,
      },
      "-=0.5",
    );
}

function initFeaturesAnimations() {
  const cards = gsap.utils.toArray(".feature-card");

  cards.forEach((card, i) => {
    gsap.from(card, {
      opacity: 0,
      y: 50,
      rotation: 5,
      duration: 0.8,
      scrollTrigger: {
        trigger: card,
        start: "top bottom-=100",
        toggleActions: "play none none reverse",
      },
    });
  });
}

function toggleCategory(category) {
  const container = document.getElementById(`${category}-commands`);
  const arrow = document.getElementById(`${category}-arrow`);
  const cards = container.querySelectorAll(".command-card");

  if (container.classList.contains("hidden")) {
    container.classList.remove("hidden");

    arrow.classList.add("rotate");

    cards.forEach((card, index) => {
      setTimeout(() => {
        card.classList.add("show");
      }, index * 100);
    });
  } else {
    cards.forEach((card) => {
      card.classList.remove("show");
    });

    arrow.classList.remove("rotate");

    setTimeout(() => {
      container.classList.add("hidden");
    }, 300);
  }
}

function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener("click", function (e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute("href"));
      const navHeight = document.querySelector("nav").offsetHeight;

      if (target) {
        const targetPosition =
          target.getBoundingClientRect().top + window.pageYOffset - navHeight;

        window.scrollTo({
          top: targetPosition,
          behavior: "smooth",
        });

        if (this.getAttribute("href") === "#commands") {
          gsap.to("#commands", {
            backgroundColor: "rgba(79, 70, 229, 0.1)",
            duration: 0.3,
            yoyo: true,
            repeat: 1,
          });
        }
      }
    });
  });
}

function initScrollAnimations() {
  gsap.to("nav", {
    scrollTrigger: {
      trigger: "body",
      start: "top top",
      end: "+=100",
      toggleClass: { targets: "nav", className: "nav-blur" },
      scrub: true,
    },
  });

  gsap.from("#commands .bg-white\\/5", {
    opacity: 0,
    y: 50,
    stagger: 0.2,
    duration: 0.8,
    scrollTrigger: {
      trigger: "#commands",
      start: "top center+=100",
      toggleActions: "play none none reverse",
    },
  });
}

document.addEventListener("DOMContentLoaded", initializeWebsite);

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    const loader = document.getElementById("loader");
    if (loader) {
      loader.style.opacity = "0";
      setTimeout(() => loader.remove(), 500);
    }
  }, 1000);
});

gsap.registerPlugin(ScrollTrigger);
gsap.from("#hero-heading", {
  opacity: 0,
  y: 50,
  duration: 1.5,
  delay: 0.5,
  ease: "power4.out",
});

gsap.from("#hero-subheading", {
  opacity: 0,
  y: 30,
  duration: 1.2,
  delay: 0.7,
  ease: "power4.out",
});

gsap.from("#hero-button1", {
  opacity: 0,
  y: 20,
  duration: 1,
  delay: 1,
  ease: "power4.out",
});

gsap.from("#hero-button2", {
  opacity: 0,
  y: 20,
  duration: 1,
  delay: 1.2,
  ease: "power4.out",
});

gsap.from("#hero-logo", {
  opacity: 0,
  scale: 0.8,
  duration: 1.5,
  delay: 0.5,
  ease: "power4.out",
});

function initHeroAnimations() {
  const timeline = gsap.timeline({ defaults: { ease: "power3.out" } });

  timeline
    .from("#hero h1", {
      opacity: 0,
      y: 100,
      duration: 1,
    })
    .from(
      "#hero p",
      {
        opacity: 0,
        y: 50,
        duration: 0.8,
      },
      "-=0.5",
    )
    .from(
      "#hero button",
      {
        opacity: 0,
        y: 50,
        duration: 0.8,
        stagger: 0.2,
      },
      "-=0.5",
    )
    .from(
      "#hero img",
      {
        opacity: 0,
        x: 100,
        duration: 1,
      },
      "-=0.5",
    );
}

function initFeaturesAnimations() {
  const cards = gsap.utils.toArray(".feature-card");

  cards.forEach((card, i) => {
    gsap.from(card, {
      opacity: 0,
      y: 50,
      rotation: 5,
      duration: 0.8,
      scrollTrigger: {
        trigger: card,
        start: "top bottom-=100",
        toggleActions: "play none none reverse",
      },
    });
  });
}

function toggleCategory(category) {
  const commandsDiv = document.getElementById(`${category}-commands`);
  const arrow = document.getElementById(`${category}-arrow`);

  if (!loadedCategories.has(category)) {
    const commandsHTML = commandsData[category].commands
      .map((cmd) => createCommandHTML(cmd))
      .join("");
    commandsDiv.innerHTML = commandsHTML;
    loadedCategories.add(category);
  }

  commandsDiv.classList.toggle("hidden");
  arrow.classList.toggle("rotate-180");
}

function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener("click", function (e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute("href"));
      const navHeight = document.querySelector("nav").offsetHeight;

      if (target) {
        const targetPosition =
          target.getBoundingClientRect().top + window.pageYOffset - navHeight;

        window.scrollTo({
          top: targetPosition,
          behavior: "smooth",
        });

        if (this.getAttribute("href") === "#commands") {
          gsap.to("#commands", {
            backgroundColor: "rgba(79, 70, 229, 0.1)",
            duration: 0.3,
            yoyo: true,
            repeat: 1,
          });
        }
      }
    });
  });
}

function initScrollAnimations() {
  gsap.to("nav", {
    scrollTrigger: {
      trigger: "body",
      start: "top top",
      end: "+=100",
      toggleClass: { targets: "nav", className: "nav-blur" },
      scrub: true,
    },
  });

  gsap.from("#commands .bg-white\\/5", {
    opacity: 0,
    y: 50,
    stagger: 0.2,
    duration: 0.8,
    scrollTrigger: {
      trigger: "#commands",
      start: "top center+=100",
      toggleActions: "play none none reverse",
    },
  });
}

function initializeWebsite() {
  initHeroAnimations();
  // initFeaturesAnimations();
  initScrollAnimations();
  initSmoothScroll();

  const ctaButtons = document.querySelectorAll(".gradient-bg");
  ctaButtons.forEach((button) => button.classList.add("pulse-on-hover"));

  const featureCards = document.querySelectorAll(".feature-card");
  featureCards.forEach((card) => card.classList.add("shine-effect"));
}
async function updateGitHubStats() {
  try {
    const response = await fetch(
      "",
    );
    const data = await response.json();

    document.getElementById("stars-count").textContent =
      `${data.stargazers_count} Stars`;
    document.getElementById("forks-count").textContent =
      `${data.forks_count} Forks`;
  } catch (error) {
    console.error("Error fetching GitHub stats:", error);
  }
}

updateGitHubStats();
setInterval(updateGitHubStats, 300000);

function scrollToTop() {
  window.scrollTo({
    top: 0,
    behavior: "smooth",
  });
}

window.onscroll = function () {
  const button = document.querySelector('[onclick="scrollToTop()"]');
  if (
    document.body.scrollTop > 500 ||
    document.documentElement.scrollTop > 500
  ) {
    button.style.opacity = "1";
    button.style.pointerEvents = "auto";
  } else {
    button.style.opacity = "0";
    button.style.pointerEvents = "none";
  }
};

document.addEventListener("DOMContentLoaded", initializeWebsite);
document.addEventListener("DOMContentLoaded", function () {
  const container = document.getElementById("commands-container");

  const categoriesHTML = Object.entries(commandsData)
    .map(([key, category]) => createCategoryButton(key, category))
    .join("");

  container.innerHTML = categoriesHTML;
});

function toggleMobileMenu() {
  const mobileMenu = document.getElementById("mobileMenu");
  const menuIcon = document.querySelector(".menu-icon");
  const menuButton = document.querySelector(".md\\:hidden button");

  if (mobileMenu.classList.contains("hidden")) {
    // Show menu
    mobileMenu.classList.remove("hidden");
    mobileMenu.classList.add("animate-fade-in");
    menuIcon.setAttribute("d", "M6 18L18 6M6 6l12 12");
  } else {
    // Hide menu
    mobileMenu.classList.add("hidden");
    mobileMenu.classList.remove("animate-fade-in");
    menuIcon.setAttribute("d", "M4 6h16M4 12h16M4 18h16");
  }

  // Stop event propagation
  event.stopPropagation();
}

// Close mobile menu when clicking outside
document.addEventListener("click", (e) => {
  const mobileMenu = document.getElementById("mobileMenu");
  const menuButton = document.querySelector(".md\\:hidden button");

  // Only close if menu is open and click is outside menu and button
  if (
    !mobileMenu.classList.contains("hidden") &&
    !mobileMenu.contains(e.target) &&
    !menuButton.contains(e.target)
  ) {
    mobileMenu.classList.add("hidden");
    mobileMenu.classList.remove("animate-fade-in");
    document
      .querySelector(".menu-icon")
      .setAttribute("d", "M4 6h16M4 12h16M4 18h16");
  }
});

// Prevent menu from closing when clicking inside
document.getElementById("mobileMenu")?.addEventListener("click", (e) => {
  e.stopPropagation();
});