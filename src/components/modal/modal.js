import { useEffect } from 'react'
import './modal.css'

const Modal = ({ showModal, handleClose, msg }) => {

    useEffect(() => {
        if (!showModal) return;
        const handleKeyDown = (e) => {
            if (e.key === "Escape") handleClose();
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [showModal, handleClose]);

    if (showModal !== true) return null;

    return (
        <div className="am-overlay" onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}>
            <div className="am-content">
                <button className="am-close" onClick={handleClose} aria-label="Fechar">&times;</button>
                <p className="am-msg">{msg}</p>
                <button className="am-btn" onClick={handleClose}>Fechar</button>
            </div>
        </div>
    )
}

export default Modal
