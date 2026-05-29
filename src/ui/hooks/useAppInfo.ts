import { useEffect, useState } from 'react';
import { fetchAppInfo } from '../../app/appInfo';
import type { AppInfo } from '../../shared/types';

const FALLBACK: AppInfo = {
  app_version: 'dev',
  protocol_version: 11,
};

export function useAppInfo() {
  const [appInfo, setAppInfo] = useState<AppInfo>(FALLBACK);

  useEffect(() => {
    let cancelled = false;
    void fetchAppInfo()
      .then((info) => {
        if (!cancelled) setAppInfo(info);
      })
      .catch(() => {
        if (!cancelled) setAppInfo(FALLBACK);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return appInfo;
}
