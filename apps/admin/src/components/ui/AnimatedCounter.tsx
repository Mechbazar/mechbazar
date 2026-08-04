import { useEffect, useRef } from 'react';
import { animate, useMotionValue, useTransform } from 'framer-motion';

interface AnimatedCounterProps {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  duration?: number;
  className?: string;
}

export function AnimatedCounter({ value, prefix = '', suffix = '', decimals = 0, duration = 0.8, className = '' }: AnimatedCounterProps) {
  const motionValue = useMotionValue(0);
  const ref = useRef<HTMLSpanElement>(null);
  const rounded = useTransform(motionValue, (v) =>
    `${prefix}${v.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${suffix}`
  );

  useEffect(() => {
    const controls = animate(motionValue, value, { duration, ease: [0.16, 1, 0.3, 1] });
    return controls.stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    return rounded.on('change', (v) => {
      if (ref.current) ref.current.textContent = v;
    });
  }, [rounded]);

  return <span ref={ref} className={className}>{prefix}0{suffix}</span>;
}
