import type { Config, Driver } from 'driver.js';
import 'driver.js/dist/driver.css';

export const TOUR_SELECTORS = {
  creditBadge: '#tour-credit-badge',
  hubNav: '#tour-hub-nav',
  keywordInput: '#tour-keyword-input',
} as const;

const BASE_DRIVER_CONFIG: Config = {
  animate: true,
  allowClose: false,
  allowKeyboardControl: false,
  showProgress: true,
  progressText: '{{current}} of {{total}}',
  overlayOpacity: 0.82,
  overlayColor: '#020617',
  stagePadding: 10,
  stageRadius: 10,
  popoverClass: 'omg-tour-popover',
  showButtons: ['next', 'previous'],
  overlayClickBehavior: () => undefined,
  nextBtnText: 'Next',
  prevBtnText: 'Back',
  doneBtnText: 'Finish',
};

async function loadDriver(): Promise<typeof import('driver.js')> {
  return import('driver.js');
}

export async function createGuidedMissionDriver(config?: Config): Promise<Driver> {
  const { driver } = await loadDriver();
  return driver({
    ...BASE_DRIVER_CONFIG,
    ...config,
  });
}

function waitForElement(
  selector: string,
  timeoutMs = 8000
): Promise<Element | null> {
  return new Promise((resolve) => {
    const existing = document.querySelector(selector);
    if (existing) {
      resolve(existing);
      return;
    }

    const observer = new MutationObserver(() => {
      const element = document.querySelector(selector);
      if (element) {
        observer.disconnect();
        resolve(element);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    window.setTimeout(() => {
      observer.disconnect();
      resolve(document.querySelector(selector));
    }, timeoutMs);
  });
}

export async function runDashboardTourPhase(
  onAdvanceToHubSpoke: () => void
): Promise<void> {
  const creditElement = await waitForElement(TOUR_SELECTORS.creditBadge);
  const hubNavElement = await waitForElement(TOUR_SELECTORS.hubNav);

  if (!creditElement || !hubNavElement) {
    return;
  }

  try {
    const driverObj = await createGuidedMissionDriver();

    driverObj.setSteps([
      {
        element: TOUR_SELECTORS.creditBadge,
        popover: {
          title: 'Your Fuel Gauge',
          description:
            'You have 100 Lightning Credits. Every AI generation deducts from here.',
          side: 'bottom',
          align: 'end',
        },
      },
      {
        element: TOUR_SELECTORS.hubNav,
        popover: {
          title: 'Mission Control',
          description:
            'This is your primary architecture tool. Click here to map out your topical authority.',
          side: 'right',
          align: 'start',
          nextBtnText: 'Go to Hub & Spoke',
          onNextClick: (_element, _step, { driver: activeDriver }) => {
            activeDriver.destroy();
            onAdvanceToHubSpoke();
          },
        },
      },
    ]);

    driverObj.drive();
  } catch (error) {
    console.error('[guided-tour] Dashboard phase failed:', error);
  }
}

export async function runHubSpokeTourPhase(onComplete: () => void): Promise<void> {
  const keywordInput = await waitForElement(TOUR_SELECTORS.keywordInput);

  if (!keywordInput) {
    return;
  }

  try {
    const driverObj = await createGuidedMissionDriver({
      showButtons: ['next'],
      doneBtnText: 'Got it',
    });

    driverObj.setSteps([
      {
        element: TOUR_SELECTORS.keywordInput,
        popover: {
          title: 'Initialize the Engine',
          description:
            "Enter a broad niche keyword (e.g., 'SaaS Marketing') and click Generate. Watch the AI build your silo.",
          side: 'bottom',
          align: 'start',
          showButtons: ['next'],
          doneBtnText: 'Got it',
          onDoneClick: (_element, _step, { driver: activeDriver }) => {
            activeDriver.destroy();
            onComplete();
          },
        },
      },
    ]);

    driverObj.drive();
  } catch (error) {
    console.error('[guided-tour] Hub & Spoke phase failed:', error);
  }
}
