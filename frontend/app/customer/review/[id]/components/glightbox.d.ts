declare module 'glightbox' {
  interface GLightboxOptions {
    selector?: string;
    touchNavigation?: boolean;
    loop?: boolean;
    autoplayVideos?: boolean;
  }

  interface GLightboxInstance {
    destroy: () => void;
  }

  function GLightbox(options?: GLightboxOptions): GLightboxInstance;
  
  export default GLightbox;
}

declare module 'glightbox/dist/css/glightbox.min.css';
