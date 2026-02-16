'use client';

import { useEffect, useRef } from 'react';
import { mount, unmount, type Component, type ComponentProps } from 'svelte';

type AnySvelteComponent = Component<any, any, any>;

type SvelteMountProps<TComponent extends AnySvelteComponent> = {
  component: TComponent;
  props: ComponentProps<TComponent>;
};

export default function SvelteMount<TComponent extends AnySvelteComponent>({
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
