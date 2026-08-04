import { motion } from 'framer-motion';
import { icon3dSrc, type Icon3DName } from '../../assets/icons3d/manifest';
import { floatLoop } from '../../utils/motion';

interface Icon3DProps {
  name: Icon3DName;
  size?: number;
  eager?: boolean;
  animate?: 'float' | 'none';
  className?: string;
  alt?: string;
}

export function Icon3D({ name, size = 32, eager = false, animate = 'none', className = '', alt = '' }: Icon3DProps) {
  const src = icon3dSrc[name];

  if (animate === 'float') {
    return (
      <motion.img
        src={src}
        width={size}
        height={size}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        alt={alt}
        role={alt ? 'img' : 'presentation'}
        className={`select-none ${className}`}
        animate={floatLoop}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <img
      src={src}
      width={size}
      height={size}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      alt={alt}
      role={alt ? 'img' : 'presentation'}
      className={`select-none ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
