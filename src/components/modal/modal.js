import './modal.css'

const Modal = ({showModal, handleClose, msg}) => {
    
    if(showModal === true){
        return(
            <div className="modal-overlay">
            <div className="modal-content">
                <span className="close-button" onClick={handleClose}>&times;</span>
                <p>{msg}</p>
                <button onClick={handleClose}>Fechar Modal</button>
            </div>
            </div>
        )
    }

}

export default Modal