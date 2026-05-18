const Loader = () => {
  return (
    <div className="fixed inset-0 z-50 bg-linear-to-br from-[#0a8b9b] to-[#153f43] flex items-center justify-center">
      <div className="text-center">
        <div className="animate-pulse">
          <img
            src="/logos/logo-short-green.webp"
            alt="Even Logo"
            className="size-24 justify-self-center"
          />
        </div>
      </div>
    </div>
  );
};

export default Loader;
