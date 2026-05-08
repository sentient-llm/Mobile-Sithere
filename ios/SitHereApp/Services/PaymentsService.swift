import Foundation
import PassKit

final class PaymentsService {
    func canMakeApplePayPayments() -> Bool {
        PKPaymentAuthorizationController.canMakePayments()
    }

    func merchantIdentifierPlaceholder() -> String {
        "merchant.com.sithere.app"
    }
}
