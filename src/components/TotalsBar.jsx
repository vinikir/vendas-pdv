export default function TotalsBar({ cart }) {
    const subtotal = cart.reduce((sum, item) => 
      sum + (item.listPrice * item.qty), 0);
    
    const totalDiscount = cart.reduce((sum, item) => 
      sum + (item.discount * item.qty), 0);
  
    const total = subtotal - totalDiscount;
  
    return (
      <div className="pdv-totals bg-[#2a2a2a] p-4 rounded-lg">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="text-gray-400">Subtotal:</div>
          <div className="text-right">R$ {subtotal.toFixed(2)}</div>
          
          <div className="text-red-400">Descontos:</div>
          <div className="text-right text-red-400">
            - R$ {totalDiscount.toFixed(2)}
          </div>
  
          <div className="col-span-2 border-t border-[#f0660a] my-2 pt-2 font-bold">
            <span>TOTAL A PAGAR:</span>
            <span className="float-right text-[#f0660a]">
              R$ {total.toFixed(2)}
            </span>
          </div>
        </div>
      </div>
    );
  }