
function BgBoss({ opacity }: { opacity: string }) {
    return (
        <div className=" w-full ">
            <div className="pointer-events-none absolute inset-0 isolate -z-10" area-hidden="true">
                <div area-hidden="true" className={`bg-[url('/bg-boss.jpg')] inset-0 absolute h-full w-full bg-cover bg-fixed bg-center ${opacity}`}>
                </div>
            </div>
        </div>
    )
}

export default BgBoss