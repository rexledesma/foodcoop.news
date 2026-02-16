'use client';

import { useEffect, useRef } from 'react';
import { mount, unmount, type Component, type ComponentProps } from 'svelte';

type SvelteComponent = Component<Record<string, unknown>>;

type SvelteMountProps<TComponent extends SvelteComponent> = {
  component: TComponent;
  props: ComponentProps<TComponent>;
};

export default function SvelteMount<TComponent extends SvelteComponent>({
  component,
  props,
}: SvelteMountProps<TComponent>) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const instance = mount(component, {
      target: host,
      props,
    });

    return () => {
      void unmount(instance);
    };
  }, [component, props]);

  return <div ref={hostRef} />;
}
