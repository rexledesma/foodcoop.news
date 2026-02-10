import { Integrations } from '@/components/Integrations';

export const metadata = {
  title: 'Integrations',
  description:
    'Connect foodcoop.news features with your calendar and wallet for easier Park Slope Food Coop access.',
  openGraph: {
    title: 'Integrations · foodcoop.news',
    description:
      'Connect foodcoop.news features with your calendar and wallet for easier Park Slope Food Coop access.',
  },
};

export default function IntegrationsPage() {
  return <Integrations />;
}
