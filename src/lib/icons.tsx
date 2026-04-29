import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faWaveSquare, faAlignLeft, faAnglesDown, faAt,
  faArrowDown, faArrowRight, faArrowTrendUp, faArrowUp, faArrowUpAZ,
  faArrowUpRightFromSquare, faArrowsRotate, faArrowsUpDown,
  faBell, faBellSlash, faBold, faBoxArchive, faBoxOpen, faBug, faBuilding, faBullhorn, faBullseye,
  faCalendar, faCalendarDay, faCalendarDays, faCalendarWeek, faCamera,
  faChartArea, faChartColumn, faChartLine, faCheck, faCheckDouble,
  faChevronDown, faChevronLeft, faChevronRight,
  faCircleCheck, faCircleExclamation, faCircleInfo, faCircleNotch,
  faClock, faCode, faCompactDisc, faCompress, faCopy, faCreditCard, faCrown,
  faDownload, faEllipsis, faEnvelope, faExpand, faEye, faEyeSlash,
  faFaceSmile, faFileLines, faFilter, faFloppyDisk, faFolderOpen,
  faGauge, faGear, faGift,
  faHighlighter, faHourglass,
  faImage, faInbox, faItalic,
  faKey, faKeyboard,
  faLayerGroup, faLink, faList, faListOl, faListUl, faLock,
  faMagnifyingGlass, faMagnifyingGlassMinus, faMagnifyingGlassPlus, faMessage,
  faPalette, faPaperPlane, faPaperclip, faPencil, faPenToSquare, faPlug, faPlus,
  faQuoteRight,
  faRepeat, faRightFromBracket, faRotateLeft,
  faShareNodes, faShield, faShieldHalved, faSliders, faSort,
  faSpinner, faSquare as faSquareSolid, faSquareCheck, faStopwatch, faStrikethrough,
  faTable, faTableCellsLarge, faTableColumns, faTableList, faTag, faThumbtack, faTicket,
  faTrash, faTriangleExclamation,
  faUnderline, faUpload, faUser, faUserCheck, faUserMinus, faUserPlus, faUsers,
  faVideo, faWandMagicSparkles, faWrench,
  faXmark,
} from '@fortawesome/free-solid-svg-icons'
import { faSquare as faSquareRegular } from '@fortawesome/free-regular-svg-icons'
import type { CSSProperties, MouseEventHandler } from 'react'

/** Mapa lucide → Font Awesome.
 *  Mantemos os nomes lucide para que a migração dos 48 arquivos seja apenas mecânica. */
const ICON_MAP = {
  Activity: faWaveSquare,
  AlertCircle: faCircleExclamation,
  AlertOctagon: faTriangleExclamation,
  AlertTriangle: faTriangleExclamation,
  AlignLeft: faAlignLeft,
  Archive: faBoxArchive,
  ArchiveRestore: faBoxOpen,
  AreaChart: faChartArea,
  ArrowDown: faArrowDown,
  ArrowRight: faArrowRight,
  ArrowUp: faArrowUp,
  ArrowUpDown: faArrowsUpDown,
  ArrowUpRight: faArrowTrendUp,
  AtSign: faAt,
  BarChart3: faChartColumn,
  Bell: faBell,
  BellOff: faBellSlash,
  Bold: faBold,
  Bug: faBug,
  Building2: faBuilding,
  Calendar: faCalendar,
  CalendarIcon: faCalendar,
  CalendarClock: faCalendarDay,
  CalendarDays: faCalendarDays,
  CalendarRange: faCalendarWeek,
  Camera: faCamera,
  Check: faCheck,
  CheckCheck: faCheckDouble,
  CheckCircle2: faCircleCheck,
  CheckSquare: faSquareCheck,
  ChevronDown: faChevronDown,
  ChevronLeft: faChevronLeft,
  ChevronRight: faChevronRight,
  ChevronsDownUp: faAnglesDown,
  ChevronsUpDown: faSort,
  Clock: faClock,
  Code: faCode,
  Columns3: faTableColumns,
  Copy: faCopy,
  CreditCard: faCreditCard,
  Crown: faCrown,
  Disc: faCompactDisc,
  Download: faDownload,
  Edit3: faPenToSquare,
  ExternalLink: faArrowUpRightFromSquare,
  Eye: faEye,
  EyeOff: faEyeSlash,
  FileText: faFileLines,
  Filter: faFilter,
  FolderOpen: faFolderOpen,
  GanttChart: faTableList,
  Gauge: faGauge,
  Gift: faGift,
  Highlighter: faHighlighter,
  Hourglass: faHourglass,
  Image: faImage,
  ImageIcon: faImage,
  Inbox: faInbox,
  Info: faCircleInfo,
  Italic: faItalic,
  KeyRound: faKey,
  Keyboard: faKeyboard,
  Layers: faLayerGroup,
  LayoutGrid: faTableCellsLarge,
  Link2: faLink,
  List: faList,
  ListOrdered: faListOl,
  ListUnordered: faListUl,
  Loader2: faCircleNotch,
  Lock: faLock,
  LogOut: faRightFromBracket,
  Mail: faEnvelope,
  Maximize2: faExpand,
  Megaphone: faBullhorn,
  MessageSquare: faMessage,
  Minimize2: faCompress,
  MoreHorizontal: faEllipsis,
  Palette: faPalette,
  Paperclip: faPaperclip,
  Pencil: faPencil,
  Pin: faThumbtack,
  Plug: faPlug,
  Plus: faPlus,
  Quote: faQuoteRight,
  RefreshCw: faArrowsRotate,
  Repeat: faRepeat,
  RotateCcw: faRotateLeft,
  Save: faFloppyDisk,
  Search: faMagnifyingGlass,
  Send: faPaperPlane,
  Settings: faGear,
  Share2: faShareNodes,
  Shield: faShield,
  ShieldAlert: faShieldHalved,
  ShieldCheck: faShieldHalved,
  ShieldX: faShieldHalved,
  SlidersHorizontal: faSliders,
  Smile: faFaceSmile,
  SortAsc: faArrowUpAZ,
  Sparkles: faWandMagicSparkles,
  Spinner: faSpinner,
  Square: faSquareRegular,
  SquareSolid: faSquareSolid,
  Strikethrough: faStrikethrough,
  Table2: faTable,
  Tag: faTag,
  Target: faBullseye,
  Ticket: faTicket,
  Timer: faStopwatch,
  Trash2: faTrash,
  TrendingUp: faChartLine,
  Underline: faUnderline,
  Upload: faUpload,
  User: faUser,
  UserCheck: faUserCheck,
  UserMinus: faUserMinus,
  UserPlus: faUserPlus,
  Users: faUsers,
  Video: faVideo,
  VideoIcon: faVideo,
  Wrench: faWrench,
  X: faXmark,
  ZoomIn: faMagnifyingGlassPlus,
  ZoomOut: faMagnifyingGlassMinus,
} as const

export type IconName = keyof typeof ICON_MAP

export interface IconProps {
  name: IconName
  size?: number
  color?: string
  className?: string
  style?: CSSProperties
  spin?: boolean
  title?: string
  /** Compat com API lucide — ignorado em FA. */
  strokeWidth?: number
  onClick?: MouseEventHandler<SVGSVGElement>
}

/** Wrapper unificado de ícones (Font Awesome).
 *  Mantém a mesma API que `lucide-react` (`size`, `color`, `className`) para
 *  facilitar a migração e padronizar peso visual em toda a app. */
export function Icon({ name, size = 16, color, className, style, spin, title, onClick }: IconProps) {
  const isSpinning = spin || name === 'Loader2' || name === 'Spinner' || /(?:^|\s)animate-spin(?:\s|$)/.test(className ?? '')
  return (
    <FontAwesomeIcon
      icon={ICON_MAP[name]}
      style={{ width: size, height: size, color, ...style }}
      className={className}
      spin={isSpinning}
      title={title}
      onClick={onClick}
    />
  )
}
