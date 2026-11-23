import { useEffect, useRef, useState } from "react";
import type { ArchiveDocumentCategory } from "../types/archive";
import { ArchiveSystem } from "../systems/ArchiveSystem";
import { DialogueSystem } from "../systems/DialogueSystem";
import { InvestigationSystem } from "../systems/InvestigationSystem";

type NotebookTab = "deduction" | "archive" | "recordings";

type Props = {
  system: InvestigationSystem;
  archiveSystem?: ArchiveSystem;
  dialogueSystem?: DialogueSystem;
  preselectedRuleId?: string;
  initialTab?: NotebookTab;
  onReplayDialogue?: (dialogueId: string) => void;
  onChange?: () => void;
};

const STATUS_LABELS: Record<string, { label: string; tone: string }> = {
  unverified: { label: "Chưa xác minh", tone: "neutral" },
  supported: { label: "Có bằng chứng ủng hộ", tone: "warn" },
  contradicted: { label: "Có bằng chứng phản bác", tone: "warn" },
  conditional_confirmed: { label: "Xác nhận có điều kiện", tone: "ok" },
  verified: { label: "ĐÃ XÁC MINH (LUẬT THẬT)", tone: "ok" },
  debunked_fake: { label: "ĐÃ BÁC BỎ (QUY TẮC GIẢ)", tone: "fake" },
  conflicted: { label: "Bằng chứng mâu thuẫn", tone: "bad" },
};

const CATEGORY_LABELS: Record<string, string> = {
  document: "TÀI LIỆU LƯU TRỮ",
  audio_transcript: "BĂNG GHI ÂM",
  blueprint: "SƠ ĐỒ KỸ THUẬT",
  cctv: "DỮ LIỆU CAMERA",
  photo: "ẢNH CHỤP HIỆN TRƯỜNG",
};

const ARCHIVE_CATEGORY_LABELS: Record<ArchiveDocumentCategory, string> = {
  diary: "NHẬT KÝ / SỔ TRỰC",
  dossier: "HỒ SƠ NHÂN SỰ",
  broadcast: "BẢN TIN VÔ TUYẾN",
  tape: "BĂNG CASSETTE",
  technical: "TÀI LIỆU KỸ THUẬT",
  cctv: "DỮ LIỆU CAMERA",
};

function renderIdentityExhibit(clueId: string) {
  if (clueId === "C-03") {
    return (
      <div className="identity-exhibit" aria-hidden="true">
        <div className="papercut-frame">
          <svg viewBox="0 0 68 82">
            <rect x="0" y="0" width="68" height="82" fill="#D8CEB8" />
            <polygon points="0,0 68,0 68,12 52,8 34,13 15,7 0,11" fill="#B5A88E" />
            <g transform="translate(3, 2)" opacity="0.35">
              <ellipse cx="34" cy="31" rx="11" ry="13" fill="#9E2323" />
              <path d="M14 78 Q16 50 34 50 Q52 50 54 78 Z" fill="#9E2323" />
            </g>
            <ellipse cx="34" cy="31" rx="11" ry="13" fill="#161A1D" />
            <path d="M14 78 Q16 50 34 50 Q52 50 54 78 Z" fill="#161A1D" />
            <line x1="12" y1="30" x2="56" y2="32" stroke="#D8CEB8" strokeWidth="1.5" strokeDasharray="3 2" />
          </svg>
        </div>
        <div className="papercut-caption">
          <span className="papercut-stamp">NIÊM PHONG NHÂN SỰ · MẤT TÍCH</span>
          <span>Ảnh hồ sơ Trạm trưởng Lê Văn Hùng — vùng khuôn mặt bị cắt rời khỏi bản lưu giấy.</span>
        </div>
      </div>
    );
  }

  if (clueId === "C-09") {
    return (
      <div className="identity-exhibit" aria-hidden="true">
        <div className="papercut-frame">
          <svg viewBox="0 0 68 82">
            <rect x="0" y="0" width="68" height="82" fill="#CFC3AA" />
            <rect x="5" y="5" width="58" height="72" fill="none" stroke="#5C5951" strokeWidth="1" strokeDasharray="3 2" />
            <g transform="translate(-3, 2)" opacity="0.45">
              <ellipse cx="34" cy="30" rx="10" ry="12" fill="#9E2323" />
              <path d="M16 72 Q18 48 34 48 Q50 48 52 72 Z" fill="#9E2323" />
            </g>
            <ellipse cx="34" cy="30" rx="10" ry="12" fill="#1C2624" />
            <path d="M16 72 Q18 48 34 48 Q50 48 52 72 Z" fill="#1C2624" />
            <polygon points="0,58 68,46 68,82 0,82" fill="#0B1319" opacity="0.72" />
            <line x1="10" y1="68" x2="58" y2="68" stroke="#D8CEB8" strokeWidth="2" />
          </svg>
        </div>
        <div className="papercut-caption">
          <span className="papercut-stamp">THẺ CŨ · MẶT SAU HƯ HẠI</span>
          <span>Thẻ nhân viên mang tên Phạm Quốc Đạt — ảnh nhận dạng mờ nhòe, bản sao chồng lệch mép giấy.</span>
        </div>
      </div>
    );
  }

  if (clueId === "C-01" || clueId === "C-06" || clueId === "C-08") {
    return (
      <div className="identity-exhibit" aria-hidden="true">
        <div className="papercut-frame">
          <svg viewBox="0 0 68 82">
            <rect x="0" y="0" width="68" height="82" fill="#121A1F" />
            <g opacity="0.42" transform="translate(4, -2)">
              <ellipse cx="34" cy="28" rx="9" ry="11" fill="#D8CEB8" />
              <path d="M18 74 Q20 46 34 46 Q48 46 50 74 Z" fill="#D8CEB8" />
            </g>
            <ellipse cx="34" cy="28" rx="9" ry="11" fill="#B5A88E" />
            <path d="M18 74 Q20 46 34 46 Q48 46 50 74 Z" fill="#B5A88E" />
            <line x1="0" y1="22" x2="68" y2="22" stroke="#9E2323" strokeWidth="1" />
            <line x1="0" y1="49" x2="68" y2="49" stroke="#9E2323" strokeWidth="1" strokeDasharray="4 2" />
          </svg>
        </div>
        <div className="papercut-caption">
          <span className="papercut-stamp">
            {clueId === "C-01" && "BẢN IN NHIỆT · SAI LỆCH THỜI GIAN"}
            {clueId === "C-06" && "TRÍCH XUẤT CCTV · HÀNH LANG"}
            {clueId === "C-08" && "TÀI LIỆU GIẤU KÍN · CHỮ VIẾT TAY"}
          </span>
          <span>
            {clueId === "C-01" && "Mô tả nhận dạng cá nhân xuất hiện trước thời điểm thực tế."}
            {clueId === "C-06" && "Hình ảnh giám sát ghi nhận dị thường bám theo nguồn sáng."}
            {clueId === "C-08" && "Tài liệu viết tay xác nhận sự tồn tại của các quy tắc giả."}
          </span>
        </div>
      </div>
    );
  }

  return null;
}

export function InvestigationNotebook({
  system,
  archiveSystem,
  dialogueSystem,
  preselectedRuleId,
  initialTab = "deduction",
  onReplayDialogue,
  onChange,
}: Props) {
  const clues = system.getDiscoveredClues();
  const unlockedDocs = archiveSystem ? archiveSystem.getUnlockedDocuments() : [];
  const totalDocs = archiveSystem ? archiveSystem.getTotalCount() : 0;
  const unreadDocsCount = archiveSystem ? archiveSystem.getUnreadCount() : 0;
  const completedDialogues = dialogueSystem ? dialogueSystem.getCompletedDialogues() : [];

  const [activeTab, setActiveTab] = useState<NotebookTab>(initialTab);
  const [selectedId, setSelectedId] = useState<string>(() => clues[0]?.id ?? "");
  const [selectedDocId, setSelectedDocId] = useState<string>(() => unlockedDocs[0]?.id ?? "");
  const [selectedRules, setSelectedRules] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const lastAppliedRuleRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (clues.length === 0) return;
    if (!selectedId || !clues.some(c => c.id === selectedId)) {
      setSelectedId(clues[0].id);
    }
  }, [clues.length, selectedId]);

  useEffect(() => {
    if (unlockedDocs.length === 0) return;
    if (!selectedDocId || !unlockedDocs.some(d => d.id === selectedDocId)) {
      setSelectedDocId(unlockedDocs[0].id);
    }
  }, [unlockedDocs.length, selectedDocId]);

  useEffect(() => {
    if (activeTab === "archive" && archiveSystem && selectedDocId) {
      if (archiveSystem.markAsRead(selectedDocId)) {
        onChange?.();
      }
    }
  }, [activeTab, selectedDocId, archiveSystem]);

  useEffect(() => {
    if (!preselectedRuleId || preselectedRuleId === lastAppliedRuleRef.current) return;
    lastAppliedRuleRef.current = preselectedRuleId;
    const matchingClue = clues.find(c => c.relatedRuleIds.includes(preselectedRuleId));
    if (matchingClue) {
      setActiveTab("deduction");
      setSelectedId(matchingClue.id);
      setSelectedRules(prev => ({ ...prev, [matchingClue.id]: preselectedRuleId }));
    }
  }, [preselectedRuleId]);

  const selectedClue = clues.find(clue => clue.id === selectedId) ?? clues[0];
  const selectedDoc = unlockedDocs.find(doc => doc.id === selectedDocId) ?? unlockedDocs[0];

  const handleLink = () => {
    if (!selectedClue) return;
    const ruleId = selectedRules[selectedClue.id] || selectedClue.relatedRuleIds[0];
    if (!ruleId) {
      setMessage({ text: "Hãy chọn một quy tắc để đối chiếu.", ok: false });
      return;
    }

    const result = system.linkClueToRule(ruleId, selectedClue.id);
    if (result.ok) {
      const status = system.getInvestigationStatus(ruleId);
      const statusText = STATUS_LABELS[status]?.label ?? status;
      setMessage({
        text: `Đã gắn ${selectedClue.id} vào ${ruleId} → Trạng thái: ${statusText}.`,
        ok: true,
      });
      onChange?.();
    } else {
      const reasonMap: Record<string, string> = {
        ALREADY_LINKED: "Manh mối này đã được gắn vào quy tắc trên.",
        NOT_DISCOVERED: "Bạn chưa phát hiện quy tắc này trong sổ luật.",
        CLUE_NOT_FOUND: "Không tìm thấy dữ liệu manh mối.",
      };
      setMessage({ text: reasonMap[result.reason] ?? result.reason, ok: false });
    }
  };

  const handleUnlink = (ruleId: string, clueId: string) => {
    const success = system.unlinkClueFromRule(ruleId, clueId);
    setMessage({
      text: success ? `Đã gỡ liên kết ${clueId} khỏi ${ruleId}.` : "Không thể gỡ liên kết.",
      ok: success,
    });
    onChange?.();
  };

  const handleOpenArchiveDoc = (docId: string) => {
    setSelectedDocId(docId);
    if (archiveSystem && archiveSystem.markAsRead(docId)) {
      onChange?.();
    }
  };

  const unlockedNotes = system.getUnlockedDeductionNotes();

  return (
    <div className="notebook-wrap">
      <div className="notebook-tabs" role="tablist" aria-label="Phân mục sổ tay điều tra">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "deduction"}
          className={`notebook-tab-btn ${activeTab === "deduction" ? "active" : ""}`}
          onClick={() => setActiveTab("deduction")}
        >
          <span>Đối chiếu manh mối ({clues.length})</span>
        </button>

        {archiveSystem && (
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "archive"}
            className={`notebook-tab-btn ${activeTab === "archive" ? "active" : ""}`}
            onClick={() => setActiveTab("archive")}
          >
            <span>Kho tư liệu V4 ({unlockedDocs.length}/{totalDocs})</span>
            {unreadDocsCount > 0 && (
              <span className="tab-unread-pill">{unreadDocsCount} mới</span>
            )}
          </button>
        )}

        {dialogueSystem && (
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "recordings"}
            className={`notebook-tab-btn ${activeTab === "recordings" ? "active" : ""}`}
            onClick={() => setActiveTab("recordings")}
          >
            <span>Bản ghi hội thoại ({completedDialogues.length})</span>
          </button>
        )}
      </div>

      {activeTab === "deduction" && (
        <>
          <div className="notebook-intro">
            <p>
              <strong>Cách đối chiếu:</strong> Chọn một manh mối bên dưới, ghép với quy tắc nghi ngờ rồi bấm{" "}
              <em>Gắn bằng chứng</em> để vạch trần quy tắc giả hoặc xác minh điều kiện sinh tồn.
            </p>
          </div>

          {clues.length === 0 ? (
            <div className="empty-box">
              <p>Chưa thu thập được manh mối nào.</p>
              <small>Hãy đọc tài liệu, nghe băng ghi âm hoặc kiểm tra camera trong các phòng.</small>
            </div>
          ) : (
            <>
              <div className="notebook-board-grid">
                <div className="clue-index-col">
                  <div className="clue-index-label">HỒ SƠ ĐÃ THU THẬP ({clues.length})</div>
                  <div className="clue-chips">
                    {clues.map(clue => {
                      const isSelected = selectedClue?.id === clue.id;
                      return (
                        <button
                          type="button"
                          key={clue.id}
                          className={`clue-chip ${isSelected ? "active" : ""}`}
                          onClick={() => {
                            setSelectedId(clue.id);
                            setMessage(null);
                          }}
                        >
                          <span className="chip-top">
                            <span>{clue.id}</span>
                            <span className="chip-cat">{CATEGORY_LABELS[clue.category] ?? clue.category}</span>
                          </span>
                          <span className="chip-title">{clue.title}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {selectedClue && (
                  <article className="dossier-card">
                    <div className="dossier-header-row">
                      <div>
                        <div className="dossier-meta">
                          <span>{CATEGORY_LABELS[selectedClue.category] ?? selectedClue.category}</span>
                          <span>·</span>
                          <b>{selectedClue.id}</b>
                        </div>
                        <h4>{selectedClue.title}</h4>
                      </div>
                      <span className="stamp-badge stamp-neutral">HỒ SƠ 1998</span>
                    </div>

                    <p className="dossier-summary">{selectedClue.summary}</p>
                    <div className="dossier-body">{selectedClue.detailContent}</div>

                    {renderIdentityExhibit(selectedClue.id)}

                    {selectedClue.relatedRuleIds.length > 0 && (
                      <div className="thread-board">
                        <div className="thread-board-head">
                          <span>BẢNG NỐI CHỈ ĐỎ · LIÊN KẾT BẰNG CHỨNG</span>
                          <span>{selectedClue.id}</span>
                        </div>
                        <div className="thread-diagram">
                          <div className="thread-source-pin">{selectedClue.id}</div>
                          <svg className="thread-lines-svg" viewBox="0 0 48 44" aria-hidden="true">
                            {selectedClue.relatedRuleIds.map((ruleId, idx) => {
                              const isLinked = system.getLinkedClueIds(ruleId).includes(selectedClue.id);
                              const total = selectedClue.relatedRuleIds.length;
                              const targetY = total === 1 ? 22 : 8 + (idx * 28) / (total - 1);
                              return (
                                <path
                                  key={ruleId}
                                  d={`M 0 22 Q 24 ${22 + (targetY - 22) * 0.35} 48 ${targetY}`}
                                  fill="none"
                                  stroke={isLinked ? "#D93838" : "#2E3B38"}
                                  strokeWidth={isLinked ? "1.8" : "1.2"}
                                  strokeDasharray={isLinked ? undefined : "3 3"}
                                />
                              );
                            })}
                          </svg>
                          <div className="thread-targets">
                            {selectedClue.relatedRuleIds.map(ruleId => {
                              const isLinked = system.getLinkedClueIds(ruleId).includes(selectedClue.id);
                              return (
                                <div
                                  key={ruleId}
                                  className={`thread-target-node ${isLinked ? "is-linked" : ""}`}
                                >
                                  <span className="thread-pin-dot" />
                                  <span>{ruleId}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="dossier-link-box">
                      <label htmlFor="notebook-rule-select">Đối chiếu với quy tắc liên quan:</label>
                      <div className="dossier-controls">
                        <select
                          id="notebook-rule-select"
                          value={selectedRules[selectedClue.id] ?? selectedClue.relatedRuleIds[0] ?? ""}
                          onChange={e =>
                            setSelectedRules(curr => ({ ...curr, [selectedClue.id]: e.target.value }))
                          }
                        >
                          {selectedClue.relatedRuleIds.length === 0 ? (
                            <option value="">Chưa có quy tắc liên kết</option>
                          ) : (
                            selectedClue.relatedRuleIds.map(ruleId => (
                              <option key={ruleId} value={ruleId}>
                                {ruleId} ({STATUS_LABELS[system.getInvestigationStatus(ruleId)]?.label ?? "Chưa rõ"})
                              </option>
                            ))
                          )}
                        </select>
                        <button type="button" className="btn-primary" onClick={handleLink}>
                          Gắn bằng chứng
                        </button>
                      </div>
                    </div>

                    <div className="linked-rules-list">
                      {selectedClue.relatedRuleIds.map(ruleId => {
                        const linkedIds = system.getLinkedClueIds(ruleId);
                        if (!linkedIds.includes(selectedClue.id)) return null;
                        const st = system.getInvestigationStatus(ruleId);
                        const meta = STATUS_LABELS[st] ?? { label: st, tone: "neutral" };
                        return (
                          <div className="linked-row" key={ruleId}>
                            <div>
                              <strong>{ruleId}</strong>
                              <span className={`badge badge-${meta.tone}`}>{meta.label}</span>
                            </div>
                            <button
                              type="button"
                              className="btn-ghost-sm"
                              onClick={() => handleUnlink(ruleId, selectedClue.id)}
                            >
                              Gỡ
                            </button>
                          </div>
                        );
                      })}
                    </div>

                    {message && (
                      <div className={`nb-toast ${message.ok ? "ok" : "warn"}`} role="status">
                        {message.text}
                      </div>
                    )}
                  </article>
                )}
              </div>

              {unlockedNotes.length > 0 && (
                <div className="deduction-notes">
                  <div className="section-kicker">KẾT LUẬN SUY LUẬN ĐÃ MỞ KHÓA ({unlockedNotes.length})</div>
                  {unlockedNotes.map((note, idx) => (
                    <p key={idx}>• {note}</p>
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}

      {activeTab === "archive" && archiveSystem && (
        <>
          <div className="notebook-intro">
            <p>
              <strong>Kho tư liệu Trạm 09:</strong> Chỉ hiển thị các hồ sơ, bản tin và băng ghi âm bạn đã trực tiếp thu thập tại hiện trường ({unlockedDocs.length}/{totalDocs} đã mở khóa · {totalDocs - unlockedDocs.length} hồ sơ chưa phát hiện đang niêm phong).
            </p>
          </div>

          {unlockedDocs.length === 0 ? (
            <div className="empty-box">
              <p>Chưa có tài liệu lưu trữ nào được mở khóa.</p>
              <small>Hãy kiểm tra bản tin nhiệt, hồ sơ nhân sự, sổ trực và các thiết bị giám sát trong trạm.</small>
            </div>
          ) : (
            <div className="notebook-board-grid">
              <div className="clue-index-col">
                <div className="clue-index-label">
                  TƯ LIỆU ĐÃ PHÁT HIỆN ({unlockedDocs.length}/{totalDocs})
                </div>
                <div className="clue-chips">
                  {unlockedDocs.map(doc => {
                    const isSelected = selectedDoc?.id === doc.id;
                    const isDocRead = archiveSystem.isRead(doc.id);
                    return (
                      <button
                        type="button"
                        key={doc.id}
                        className={`clue-chip ${isSelected ? "active" : ""}`}
                        onClick={() => handleOpenArchiveDoc(doc.id)}
                      >
                        <span className="chip-top">
                          <span>{doc.relatedSceneId} · {doc.relatedClueIds.join(", ")}</span>
                          <span className={`archive-read-pill ${isDocRead ? "read" : "unread"}`}>
                            {isDocRead ? "ĐÃ ĐỌC" : "CHƯA ĐỌC"}
                          </span>
                        </span>
                        <span className="chip-title">{doc.title}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {selectedDoc && (
                <article className="dossier-card">
                  <div className="dossier-header-row">
                    <div>
                      <div className="dossier-meta">
                        <span>{ARCHIVE_CATEGORY_LABELS[selectedDoc.category]}</span>
                        <span>·</span>
                        <b>{selectedDoc.relatedSceneId}</b>
                        {selectedDoc.relatedClueIds.length > 0 && (
                          <>
                            <span>·</span>
                            <span>Manh mối: {selectedDoc.relatedClueIds.join(", ")}</span>
                          </>
                        )}
                      </div>
                      <h4>{selectedDoc.title}</h4>
                    </div>
                    <span className={`stamp-badge ${archiveSystem.isRead(selectedDoc.id) ? "stamp-ok" : "stamp-warn"}`}>
                      {archiveSystem.isRead(selectedDoc.id) ? "ĐÃ ĐỌC" : "MỚI MỞ"}
                    </span>
                  </div>

                  <p className="dossier-summary">
                    <strong>Nguồn thu thập:</strong> {selectedDoc.sourceLabel}
                  </p>
                  <div className="dossier-body">{selectedDoc.content}</div>
                </article>
              )}
            </div>
          )}
        </>
      )}

      {activeTab === "recordings" && dialogueSystem && (
        <>
          <div className="notebook-intro">
            <p>
              <strong>Phát lại bản ghi hội thoại:</strong> Cho phép nghe hoặc đọc lại các đoạn hội thoại đã hoàn thành mà không kích hoạt lại hiệu ứng gameplay.
            </p>
          </div>

          {completedDialogues.length === 0 ? (
            <div className="empty-box">
              <p>Chưa có đoạn hội thoại nào được lưu vào bản ghi hoàn tất.</p>
              <small>Hãy hoàn tất cuộc đối thoại mở ca hoặc tương tác vô tuyến/điện thoại tại các phòng.</small>
            </div>
          ) : (
            <div className="recordings-list">
              {completedDialogues.map(dlg => (
                <div className="recording-row" key={dlg.id}>
                  <div>
                    <div className="recording-meta">
                      <span>{dlg.sceneId}</span>
                      <span>·</span>
                      <span>{dlg.channel ?? "MONO"}</span>
                      <span>·</span>
                      <span>{dlg.id}</span>
                    </div>
                    <strong>{dlg.title}</strong>
                  </div>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => onReplayDialogue?.(dlg.id)}
                  >
                    Phát lại
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}