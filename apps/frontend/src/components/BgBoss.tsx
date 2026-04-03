function BgBoss({ opacity }: { opacity: string }) {
  return (
    <div
      className={`fixed top-0 overflow-hidden left-0 w-full h-full bg-[url('/bg-boss.jpg')] bg-cover bg-center md:bg-fixed ${opacity} -z-10`}
      aria-hidden="true"
    />
  )
}

export default BgBoss;