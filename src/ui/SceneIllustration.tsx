import type { FlagValue } from "../types/common";

type Props = {
  sceneId: string;
  flags: Readonly<Record<string, FlagValue>>;
  hasFlashlightItem: boolean;
  solvedPuzzles: readonly string[];
};

export function SceneIllustration({ sceneId, flags, hasFlashlightItem, solvedPuzzles }: Props) {
  const fogBreached = Boolean(flags.fog_breached);
  const flashlightOn = Boolean(flags.flashlight_on);
  const radioState = String(flags.radio_state ?? "broadcasting");
  const powerMode = String(flags.power_mode ?? "normal");
  const redFilter = Boolean(flags.red_filter_installed);
  const lockerKnocking = Boolean(flags.locker_knocking);
  const identityExposed = Boolean(flags.identity_exposed);
  const showPaperAnomaly = fogBreached || identityExposed;

  return (
    <div className={`scene-visual scene-bg-${sceneId.toLowerCase()}`} aria-hidden="true">
      <div className="visual-grid" />
      {flashlightOn && <div className="flashlight-cone" />}

      {sceneId === "SC-01" && (
        <svg className="scene-svg" viewBox="0 0 800 320" preserveAspectRatio="xMidYMid slice">
          <defs>
            <linearGradient id="sc01Sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#060B0F" />
              <stop offset="65%" stopColor="#0D171D" />
              <stop offset="100%" stopColor="#162223" />
            </linearGradient>
            <radialGradient id="towerGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#CFA855" stopOpacity="0.65" />
              <stop offset="55%" stopColor="#CFA855" stopOpacity="0.16" />
              <stop offset="100%" stopColor="#CFA855" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="beamSweep" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#E9D8A6" stopOpacity="0.24" />
              <stop offset="100%" stopColor="#E9D8A6" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="concreteWall" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1C2624" />
              <stop offset="100%" stopColor="#0B1319" />
            </linearGradient>
          </defs>

          {/* Đêm biển & nền trời sương mù */}
          <rect x="0" y="0" width="800" height="320" fill="url(#sc01Sky)" />
          <path d="M0 218 Q180 202 360 215 T800 208 L800 320 L0 320 Z" fill="#080E12" />

          {/* Hải đăng Mũi Sương phía xa */}
          <circle cx="576" cy="70" r="88" fill="url(#towerGlow)" />
          <polygon points="560,214 568,78 584,78 592,214" fill="#182226" stroke="#2E3B38" strokeWidth="1.5" />
          <rect x="565" y="64" width="22" height="14" fill="#E6D2A2" opacity="0.88" />
          <polygon points="587,66 800,18 800,115 587,75" fill="url(#beamSweep)" />
          <polygon points="565,67 360,22 360,112 565,75" fill="url(#beamSweep)" opacity="0.35" transform="scale(-1,1) translate(-1130,0)" />

          {/* Bóng giấy cắt bất thường trong lớp sương khi bị xâm nhập / lộ danh tính */}
          {showPaperAnomaly && (
            <g opacity="0.38">
              <polygon points="365,126 382,126 388,154 393,218 354,218 359,154" fill="#D8CEB8" />
              <ellipse cx="373" cy="113" rx="10" ry="12" fill="#D8CEB8" />
              <polygon points="370,126 387,126 393,154 398,218 359,218 364,154" fill="#070C10" opacity="0.72" />
            </g>
          )}

          {/* Vọng gác bê tông ẩm rêu bên phải */}
          <rect x="468" y="138" width="96" height="106" fill="url(#concreteWall)" stroke="#2E3B38" strokeWidth="1.5" />
          <rect x="462" y="130" width="108" height="10" fill="#23302E" stroke="#364642" strokeWidth="1" />
          <rect x="484" y="154" width="64" height="36" fill="#060B0E" stroke="#3D4E4A" strokeWidth="1.5" />
          <line x1="516" y1="154" x2="516" y2="190" stroke="#2E3B38" strokeWidth="1.5" />
          {/* Bệ gác & Đèn pin cũ */}
          <rect x="478" y="206" width="76" height="8" fill="#2B3734" />
          {!hasFlashlightItem && (
            <g>
              <circle cx="526" cy="202" r="18" fill="#CFA855" opacity="0.2" />
              <rect x="515" y="198" width="22" height="6" rx="1.5" fill="#CFA855" />
              <rect x="534" y="197" width="5" height="8" rx="1" fill="#D8CEB8" />
            </g>
          )}

          {/* Tường rào & song sắt cổng trạm */}
          <rect x="0" y="242" width="800" height="78" fill="#091015" />
          <line x1="0" y1="242" x2="800" y2="242" stroke="#2E3B38" strokeWidth="2.5" />
          {Array.from({ length: 24 }).map((_, i) => (
            <line
              key={i}
              x1={26 + i * 32}
              y1="92"
              x2={26 + i * 32}
              y2="242"
              stroke="#1F2B2A"
              strokeWidth="3.5"
            />
          ))}
          <line x1="0" y1="114" x2="800" y2="114" stroke="#253230" strokeWidth="2.5" />

          {/* Cánh cổng sắt trung tâm */}
          <g>
            <rect
              x={fogBreached ? "238" : "306"}
              y="102"
              width={fogBreached ? "54" : "156"}
              height="140"
              fill="rgba(11, 19, 25, 0.84)"
              stroke="#465854"
              strokeWidth="2.5"
            />
            {!fogBreached && (
              <>
                <line x1="384" y1="102" x2="384" y2="242" stroke="#344440" strokeWidth="2" />
                <circle cx="384" cy="170" r="7" fill="#9E2323" stroke="#D8CEB8" strokeWidth="1" />
              </>
            )}
          </g>
        </svg>
      )}

      {sceneId === "SC-02" && (
        <svg className="scene-svg" viewBox="0 0 800 320" preserveAspectRatio="xMidYMid slice">
          <defs>
            <linearGradient id="deskTop" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1E2726" />
              <stop offset="100%" stopColor="#0E151A" />
            </linearGradient>
            <radialGradient id="deskLamp" cx="50%" cy="20%" r="60%">
              <stop offset="0%" stopColor="#CFA855" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#CFA855" stopOpacity="0" />
            </radialGradient>
          </defs>

          <rect x="0" y="0" width="800" height="320" fill="#091015" />
          {/* Tường bê tông & ánh sáng đèn huỳnh quang cũ */}
          <rect x="0" y="0" width="800" height="200" fill="#0F181D" />
          <ellipse cx="400" cy="160" rx="290" ry="130" fill="url(#deskLamp)" />

          {/* Cửa sổ đêm nhìn ra sương */}
          <rect x="275" y="22" width="250" height="122" fill="#070C10" stroke="#2E3B38" strokeWidth="3" />
          <line x1="400" y1="22" x2="400" y2="144" stroke="#2E3B38" strokeWidth="2.5" />
          <line x1="275" y1="84" x2="525" y2="84" stroke="#2E3B38" strokeWidth="2" />
          {showPaperAnomaly && (
            <g opacity="0.34">
              <ellipse cx="348" cy="72" rx="14" ry="17" fill="#D8CEB8" />
              <path d="M326 144 Q348 92 370 144 Z" fill="#D8CEB8" />
              <ellipse cx="352" cy="74" rx="14" ry="17" fill="#070C10" opacity="0.65" />
            </g>
          )}

          {/* Mặt bàn trực gỗ & kim loại */}
          <polygon points="54,296 136,178 664,178 746,296" fill="url(#deskTop)" stroke="#2E3B38" strokeWidth="2" />
          <rect x="54" y="296" width="692" height="24" fill="#091014" />

          {/* Máy in nhiệt bên trái */}
          <rect x="136" y="152" width="86" height="48" rx="3" fill="#1C2624" stroke="#465854" strokeWidth="1.5" />
          <polygon points="152,152 160,118 202,118 210,152" fill="#D8CEB8" opacity="0.9" />
          <line x1="164" y1="127" x2="196" y2="127" stroke="#161A1D" strokeWidth="2" />
          <line x1="162" y1="135" x2="194" y2="135" stroke="#161A1D" strokeWidth="2" />
          <line x1="160" y1="143" x2="188" y2="143" stroke="#9E2323" strokeWidth="2" />

          {/* Sổ trực & Hồ sơ giữa bàn */}
          <rect x="330" y="190" width="140" height="62" rx="2" fill="#B5A88E" stroke="#6E634D" strokeWidth="1.5" />
          <rect x="335" y="194" width="63" height="54" fill="#D8CEB8" />
          <rect x="402" y="194" width="63" height="54" fill="#D8CEB8" />
          <line x1="400" y1="190" x2="400" y2="252" stroke="#4C4537" strokeWidth="2" />
          <rect x="412" y="204" width="22" height="26" fill="#1C2624" opacity="0.85" />

          {/* Máy bộ đàm VHF bên phải */}
          <rect x="560" y="138" width="102" height="68" rx="3" fill="#141E23" stroke="#465854" strokeWidth="1.5" />
          <line x1="646" y1="138" x2="646" y2="78" stroke="#85928E" strokeWidth="2.5" />
          <rect x="574" y="152" width="74" height="26" fill="#070C10" stroke="#2E3B38" />
          {radioState === "broadcasting" ? (
            <polyline
              points="580,165 590,157 598,173 608,154 618,174 628,158 640,165"
              fill="none"
              stroke="#CFA855"
              strokeWidth="2"
            />
          ) : (
            <line
              x1="580"
              y1="165"
              x2="640"
              y2="165"
              stroke={radioState === "paused" ? "#4B8F6E" : "#5F6C68"}
              strokeWidth="2"
            />
          )}
        </svg>
      )}

      {sceneId === "SC-03" && (
        <svg className="scene-svg" viewBox="0 0 800 320" preserveAspectRatio="xMidYMid slice">
          <defs>
            <linearGradient id="corridorWall" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0D161A" />
              <stop offset="100%" stopColor="#182321" />
            </linearGradient>
          </defs>

          <rect x="0" y="0" width="800" height="320" fill="url(#corridorWall)" />
          <rect x="0" y="256" width="800" height="64" fill="#091014" />
          <line x1="70" y1="256" x2="730" y2="256" stroke="#2E3B38" strokeWidth="2.5" />

          {/* Giường sắt nhân viên ở tiền cảnh giữa-trái */}
          <rect x="290" y="206" width="128" height="12" fill="#23302D" stroke="#3C4B47" />
          <line x1="294" y1="184" x2="294" y2="256" stroke="#3C4B47" strokeWidth="3" />
          <line x1="414" y1="194" x2="414" y2="256" stroke="#3C4B47" strokeWidth="3" />
          <rect x="332" y="246" width="18" height="8" fill="#D8CEB8" opacity="0.85" />

          {/* Tủ dụng cụ khóa chặt bên trái */}
          <rect x="128" y="114" width="124" height="142" fill="#131C21" stroke="#3F4F4B" strokeWidth="2" />
          <line x1="190" y1="114" x2="190" y2="256" stroke="#2E3B38" strokeWidth="1.5" />
          <circle cx="178" cy="184" r="6" fill="#CFA855" />

          {/* Dãy 4 tủ cá nhân */}
          {[0, 1, 2, 3].map(idx => {
            const x = 442 + idx * 72;
            const isLocker4 = idx === 3;
            return (
              <g key={idx} className={isLocker4 && lockerKnocking ? "svg-shake" : ""}>
                <rect
                  x={x}
                  y="74"
                  width="64"
                  height="182"
                  fill={isLocker4 ? "#1A1417" : "#121B20"}
                  stroke={isLocker4 ? "#9E2323" : "#344440"}
                  strokeWidth="1.5"
                />
                <line x1={x + 12} y1="94" x2={x + 52} y2="94" stroke="#2E3B38" strokeWidth="2" />
                <line x1={x + 12} y1="102" x2={x + 52} y2="102" stroke="#2E3B38" strokeWidth="2" />
                <text x={x + 22} y="132" fill={isLocker4 ? "#D93838" : "#B5A88E"} fontSize="13" fontFamily="monospace">
                  0{idx + 1}
                </text>
              </g>
            );
          })}

          {showPaperAnomaly && (
            <g opacity="0.32">
              <polygon points="695,120 715,120 722,162 728,256 684,256 690,162" fill="#D8CEB8" />
              <ellipse cx="705" cy="105" rx="11" ry="13" fill="#D8CEB8" />
            </g>
          )}
        </svg>
      )}

      {sceneId === "SC-04" && (
        <svg className="scene-svg" viewBox="0 0 800 320" preserveAspectRatio="xMidYMid slice">
          <rect x="0" y="0" width="800" height="320" fill="#0A1217" />
          <rect x="0" y="260" width="800" height="60" fill="#070C10" />

          {/* Đường ống kỹ thuật */}
          <line x1="0" y1="42" x2="800" y2="42" stroke="#1C2624" strokeWidth="10" />
          <line x1="0" y1="58" x2="800" y2="58" stroke="#2E3B38" strokeWidth="4" />

          {/* Sơ đồ tải điện treo tường bên trái */}
          <rect x="132" y="84" width="166" height="118" fill="#D8CEB8" opacity="0.14" stroke="#B5A88E" strokeWidth="1.5" />
          <path d="M156 122 H218 V162 H274" fill="none" stroke="#CFA855" strokeWidth="2" />
          <circle cx="218" cy="142" r="13" fill="none" stroke="#9E2323" strokeWidth="2" />

          {/* Tủ máy phát & Bảng tải */}
          <rect x="424" y="76" width="236" height="184" rx="3" fill="#131C21" stroke="#3F4F4B" strokeWidth="2" />
          <circle cx="542" cy="136" r="38" fill="#070C10" stroke="#85928E" strokeWidth="2" />
          <line
            x1="542"
            y1="136"
            x2={powerMode === "low" ? "516" : powerMode === "overload" ? "570" : "542"}
            y2={powerMode === "normal" ? "104" : "114"}
            stroke={powerMode === "overload" ? "#D93838" : powerMode === "low" ? "#4B8F6E" : "#CFA855"}
            strokeWidth="3"
          />
          <rect
            x="476"
            y="194"
            width="132"
            height="32"
            rx="2"
            fill={powerMode === "overload" ? "rgba(158,35,35,0.28)" : "rgba(28,38,36,0.8)"}
            stroke={powerMode === "overload" ? "#D93838" : powerMode === "low" ? "#4B8F6E" : "#CFA855"}
          />
          <text x="542" y="215" textAnchor="middle" fill="#D8CEB8" fontSize="13" fontFamily="monospace">
            {powerMode.toUpperCase()}
          </text>
        </svg>
      )}

      {sceneId === "SC-05" && (
        <svg className="scene-svg" viewBox="0 0 800 320" preserveAspectRatio="xMidYMid slice">
          <rect x="0" y="0" width="800" height="320" fill="#080F14" />
          <rect x="90" y="206" width="620" height="16" fill="#1C2624" stroke="#2E3B38" />

          {/* Màn hình CCTV hành lang bên trái */}
          <rect x="128" y="64" width="176" height="124" rx="3" fill="#070C10" stroke="#3F4F4B" strokeWidth="2" />
          <circle cx="148" cy="82" r="4" fill="#D93838" />
          <text x="158" y="86" fill="#B5A88E" fontSize="11" fontFamily="monospace">CAM-02</text>
          <path d="M144 164 Q216 122 288 166" fill="none" stroke="#85928E" strokeWidth="2" opacity="0.55" />
          {showPaperAnomaly && (
            <ellipse cx="216" cy="126" rx="10" ry="13" fill="#D8CEB8" opacity="0.35" />
          )}

          {/* Màn hình Radar trung tâm + Vết xước bán nguyệt */}
          <circle cx="400" cy="126" r="70" fill="#081613" stroke="#4B8F6E" strokeWidth="2" />
          <circle cx="400" cy="126" r="46" fill="none" stroke="#4B8F6E" strokeOpacity="0.35" />
          <circle cx="400" cy="126" r="22" fill="none" stroke="#4B8F6E" strokeOpacity="0.35" />
          <line x1="400" y1="126" x2="452" y2="82" stroke="#4B8F6E" strokeWidth="2" />
          <path d="M416 68 A56 56 0 0 1 456 146" fill="none" stroke="#D8CEB8" strokeWidth="3.5" opacity="0.65" />

          {/* Bảng hiệu chuẩn bên phải */}
          <rect x="498" y="64" width="174" height="124" rx="3" fill="#111A1F" stroke="#3F4F4B" strokeWidth="2" />
          <line x1="518" y1="108" x2="652" y2="108" stroke="#9E2323" strokeWidth="3" />
          <text x="518" y="136" fill="#D8CEB8" fontSize="12" fontFamily="monospace">&gt; 620nm SAFE</text>

          {/* Ngăn kéo chốt số dưới gầm bàn */}
          <rect
            x="320"
            y="226"
            width="160"
            height="46"
            rx="2"
            fill={solvedPuzzles.includes("PZ-02") ? "#1C2624" : "#0D151A"}
            stroke={solvedPuzzles.includes("PZ-02") ? "#4B8F6E" : "#CFA855"}
            strokeWidth="1.5"
          />
          <circle cx="400" cy="249" r="5" fill={solvedPuzzles.includes("PZ-02") ? "#4B8F6E" : "#CFA855"} />
        </svg>
      )}

      {sceneId === "SC-06" && (
        <svg className="scene-svg" viewBox="0 0 800 320" preserveAspectRatio="xMidYMid slice">
          <rect x="0" y="0" width="800" height="320" fill="#070C10" />

          {/* Vòm kính buồng đèn */}
          <line x1="120" y1="0" x2="80" y2="320" stroke="#1C2624" strokeWidth="3" />
          <line x1="680" y1="0" x2="720" y2="320" stroke="#1C2624" strokeWidth="3" />
          <line x1="0" y1="248" x2="800" y2="248" stroke="#2E3B38" strokeWidth="2.5" />

          {/* Luồng sáng thấu kính Fresnel */}
          <polygon
            points="400,144 20,24 20,275"
            fill={redFilter ? "#9E2323" : "#D8CEB8"}
            opacity={redFilter ? "0.28" : "0.18"}
          />
          <polygon
            points="400,144 780,24 780,275"
            fill={redFilter ? "#9E2323" : "#D8CEB8"}
            opacity={redFilter ? "0.28" : "0.18"}
          />

          {/* Trụ thấu kính trung tâm */}
          <rect x="352" y="54" width="96" height="194" rx="10" fill="#111A1E" stroke="#465854" strokeWidth="2" />
          <ellipse
            cx="400"
            cy="144"
            rx="36"
            ry="62"
            fill={redFilter ? "#D93838" : "#ECE4CE"}
            opacity={redFilter ? "0.78" : "0.86"}
          />
          <line x1="362" y1="112" x2="438" y2="112" stroke="#1C2624" strokeWidth="2" />
          <line x1="362" y1="144" x2="438" y2="144" stroke="#1C2624" strokeWidth="2" />
          <line x1="362" y1="176" x2="438" y2="176" stroke="#1C2624" strokeWidth="2" />

          {/* Khay lắp kính lọc quang học */}
          <rect
            x="222"
            y="120"
            width="54"
            height="54"
            rx="2"
            fill={redFilter ? "rgba(158,35,35,0.34)" : "#131C21"}
            stroke={redFilter ? "#D93838" : "#CFA855"}
            strokeWidth="2"
          />
        </svg>
      )}

      <div className="stage-fog" />
      <div className="stage-vignette" />
    </div>
  );
}