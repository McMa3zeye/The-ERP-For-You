import { useLocation } from 'react-router-dom'
import InfoButton from './InfoButton'
import { getHelpKeyForPath } from '../help/helpKeys'

export default function PageHelpCorner() {
  const location = useLocation()
  const helpKey = getHelpKeyForPath(location.pathname)

  return (
    <span className="page-help-sup">
      <InfoButton helpKey={helpKey} label="Help" />
    </span>
  )
}

