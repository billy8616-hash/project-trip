import { MiniMap } from './illustrations.jsx'
import './AdventureMap.css'

export default function AdventureMap() {
  return (
    <article className="amap card">
      <h3 className="amap__title">YOUR ADVENTURE MAP</h3>

      <div className="amap__figure">
        <MiniMap className="amap__svg" />
        <span className="amap__pin amap__pin--gyeongju">Gyeongju</span>
        <span className="amap__pin amap__pin--busan">Busan</span>
        <span className="amap__pin amap__pin--jeju">
          Jeju
          <br />
          Island
        </span>
      </div>
    </article>
  )
}
