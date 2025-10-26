import React from 'react';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';

export default function Loader() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-white z-50">
      <DotLottieReact
        src="https://lottie.host/8be934e7-af0b-4970-bdfb-2b832c861a45/kGTESI11CA.lottie"
        loop
        autoplay
        style={{ width: 180, height: 180 }}
      />
    </div>
  );
}
