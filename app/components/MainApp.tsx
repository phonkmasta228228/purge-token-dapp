'use client';

import { FC, useState } from 'react';
import { Navbar } from './Navbar';
import { TabNav, Tab } from './TabNav';
import { ClaimRank } from './ClaimRank';
import { ClaimRewards } from './ClaimRewards';
import { Dashboard } from './Dashboard';

export const MainApp: FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('claim-rank');

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <Navbar />
      <TabNav activeTab={activeTab} onTabChange={setActiveTab} />
      <main>
        {activeTab === 'claim-rank' && <ClaimRank />}
        {activeTab === 'claim-rewards' && <ClaimRewards />}
        {activeTab === 'dashboard' && <Dashboard />}
      </main>
    </div>
  );
};
