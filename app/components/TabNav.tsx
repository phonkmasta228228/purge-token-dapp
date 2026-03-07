'use client';

import { FC } from 'react';

export type Tab = 'claim-rank' | 'claim-rewards' | 'dashboard';

interface Props {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

const tabs: { id: Tab; label: string; icon: string }[] = [
  { id: 'claim-rank', label: 'Claim Rank', icon: '⚡' },
  { id: 'claim-rewards', label: 'Claim Rewards', icon: '🎯' },
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
];

export const TabNav: FC<Props> = ({ activeTab, onTabChange }) => {
  return (
    <div className="border-b border-[#1a1a1a] bg-[#0a0a0a]">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex gap-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`
                px-6 py-4 text-sm font-bold tracking-wider transition-all duration-200
                border-b-2 flex items-center gap-2
                ${activeTab === tab.id
                  ? 'border-[#00FFAA] text-[#00FFAA]'
                  : 'border-transparent text-[#555] hover:text-[#888] hover:border-[#333]'
                }
              `}
            >
              <span>{tab.icon}</span>
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
