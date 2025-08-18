export default function CartItem({ code, name, listPrice, discount, qty }) {
    const finalPrice = listPrice - discount;
  
    return (
      <div className="pdv-item bg-[#2a2a2a] p-3 rounded-lg">
        <div className="flex justify-between items-start">
          <div>
            <div className="font-bold text-[#f0660a]">{code} - {name}</div>
            <div className="text-sm text-gray-400 mt-1">
              {qty} × R$ {finalPrice.toFixed(2)}
            </div>
          </div>
          
          <div className="text-right">
            {discount > 0 && (
              <div className="text-xs line-through text-red-400">
                R$ {listPrice.toFixed(2)}
              </div>
            )}
            <div className="font-bold">
              R$ {(finalPrice * qty).toFixed(2)}
            </div>
          </div>
        </div>
  
        {discount > 0 && (
          <div className="mt-2 text-xs bg-[#f0660a]/10 text-[#f0660a] p-1 rounded">
            Desconto: R$ {discount.toFixed(2)} (${(discount/listPrice*100).toFixed(0)}%)
          </div>
        )}
      </div>
    );
  }