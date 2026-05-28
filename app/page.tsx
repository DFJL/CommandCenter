// Server component — imports JSON at build time, no client fetch needed
import type { Study, P21Finding } from './types';
import studiesRaw from '../public/data/studies.json';
import p21Raw from '../public/data/p21.json';
import HomeClient from './components/HomeClient';

export default function Page() {
  return (
    <HomeClient
      studies={studiesRaw as Study[]}
      findings={p21Raw as P21Finding[]}
    />
  );
}
