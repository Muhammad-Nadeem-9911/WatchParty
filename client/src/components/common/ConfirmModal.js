// d:\WatchParty\client\src\components\common\ConfirmModal.js
import React from 'react';
import './ConfirmModal.css'; // We'll create this CSS file next
import { FaTimes, FaCheck, FaExclamationTriangle } from 'react-icons/fa';

const ConfirmModal = ({ isOpen, onClose, onConfirm, title, message, confirmText = "Confirm", cancelText = "Cancel" }) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="modalOverlay">
      <div className="modalContent">
        <button onClick={onClose} className="modalCloseButton" title="Close">
          <FaTimes />
        </button>
        <div className="modalHeader">
          <FaExclamationTriangle className="modalWarningIcon" />
          <h3>{title || 'Confirm Action'}</h3>
        </div>
        <div className="modalBody">
          <p>{message || 'Are you sure you want to proceed?'}</p>
        </div>
        <div className="modalFooter">
          <button onClick={onClose} className="modalButton cancel">
            {cancelText}
          </button>
          <button onClick={onConfirm} className="modalButton confirm">
            <FaCheck style={{ marginRight: 'var(--spacing-xs)'}} /> {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;