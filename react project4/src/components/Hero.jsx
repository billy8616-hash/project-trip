import { Camera, Backpack, CameraTiny, Star } from './illustrations.jsx'
import './Hero.css'

export default function Hero() {
  return (
    <div className="hero">
      {/* ===== 카메라 블록 ===== */}
      <section className="gearblock gearblock--camera">
        <h2 className="poster poster--camera">CAMERA</h2>

        <span className="scrawl scrawl--click1">CLICK!</span>
        <span className="scrawl scrawl--mem1">MEMORIES</span>
        <span className="scrawl scrawl--mem2">MEMORIES</span>
        <span className="scrawl scrawl--adv1">ADVENTURE</span>

        <Camera className="gearblock__art gearblock__art--camera" />

        <CameraTiny className="deco deco--cam-a" />
        <CameraTiny className="deco deco--cam-b" />
        <Star className="deco deco--star-a" style={{ width: 16, height: 16 }} />
        <Star className="deco deco--star-b" style={{ width: 11, height: 11 }} />
      </section>

      {/* ===== 백팩 블록 ===== */}
      <section className="gearblock gearblock--pack">
        <h2 className="poster poster--pack">BACKPACK</h2>

        <span className="scrawl scrawl--click2">CLICK!</span>
        <span className="scrawl scrawl--adv2">ADVENTURE</span>
        <span className="scrawl scrawl--mem3">MEMORIES</span>

        <Backpack className="gearblock__art gearblock__art--pack" />

        <CameraTiny className="deco deco--cam-c" />
        <CameraTiny className="deco deco--cam-d" />
        <Star className="deco deco--star-c" style={{ width: 14, height: 14 }} />
      </section>
    </div>
  )
}
