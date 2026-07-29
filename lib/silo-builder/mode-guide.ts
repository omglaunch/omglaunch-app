import {
  SILO_COMPETITOR_ATTACK_CREDIT_COST,
  SILO_KEYWORD_MAP_CREDIT_COST,
} from '@/lib/silo-builder/constants';

export type SiloModeGuideEntry = {
  title: string;
  when: string;
  outputs: string;
  credits: number;
};

export const SILO_KEYWORD_MODE_GUIDE: SiloModeGuideEntry = {
  title: 'Build from Keyword',
  when: 'You have a seed topic to own and want a fast Hub & Spoke-style silo.',
  outputs: 'Pillar + spokes with lateral links, intent, and funnel stages.',
  credits: SILO_KEYWORD_MAP_CREDIT_COST,
};

export const SILO_COMPETITOR_MODE_GUIDE: SiloModeGuideEntry = {
  title: 'Reverse-Engineer Competitor',
  when: 'You want to reverse-engineer a rival domain and find content gaps.',
  outputs: 'Attack map plus semantic gaps, ranked keywords, and hub groups.',
  credits: SILO_COMPETITOR_ATTACK_CREDIT_COST,
};
