'use client';

import * as React from 'react';
import {
  AudioWaveform,
  BookOpen,
  Bot,
  Command,
  GalleryVerticalEnd,
  SquareTerminal,
} from 'lucide-react';

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from '@/components/ui/sidebar';
import { ModelSwitcher } from './model-switcher';
import { NavMain } from './nav-main';
import { NavUser } from './nav-user';

const data = {
  user: {
    name: 'John Doe',
    email: 'john@doe.com',
    avatar: 'https://avatar.vercel.sh/John%20Doe',
  },
  teams: [
    {
      name: 'Assistant 1',
      logo: GalleryVerticalEnd,
      plan: 'Assistant',
    },
    {
      name: 'Assistant 2',
      logo: AudioWaveform,
      plan: 'Assistant',
    },
    {
      name: 'Assistant 3',
      logo: Command,
      plan: 'Assistant',
    },
  ],
  navMain: [
    {
      title: 'Model 1',
      url: '#',
      icon: SquareTerminal,
      isActive: true,
      items: [
        {
          title: 'Chat 1',
          url: '#',
        },
        {
          title: 'Chat 2',
          url: '#',
        },
        {
          title: 'Chat 3',
          url: '#',
        },
      ],
    },
    {
      title: 'Model 2',
      url: '#',
      icon: Bot,
      items: [
        {
          title: 'Chat 1',
          url: '#',
        },
        {
          title: 'Chat 2',
          url: '#',
        },
        {
          title: 'Chat 3',
          url: '#',
        },
      ],
    },
    {
      title: 'Model 3',
      url: '#',
      icon: BookOpen,
      items: [
        {
          title: 'Chat 1',
          url: '#',
        },
        {
          title: 'Chat 2',
          url: '#',
        },
        {
          title: 'Chat 3',
          url: '#',
        },
        {
          title: 'Chat 4',
          url: '#',
        },
      ],
    },
  ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <ModelSwitcher teams={data.teams} />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
