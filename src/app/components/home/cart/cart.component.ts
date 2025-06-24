import { Component, effect, signal, WritableSignal } from '@angular/core';
import { faTrash } from '@fortawesome/free-solid-svg-icons';
import { CartItem } from '../types/cart.type';
import { ActivatedRoute, Router } from '@angular/router';
import { CartStoreItem } from '../services/cart/cart.storeItem';
import { faBoxOpen } from '@fortawesome/free-solid-svg-icons';
import { faShoppingCart } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { CommonModule, NgClass } from '@angular/common';
import { RatingsComponent } from '../../ratings/ratings.component';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { LoggedInUser } from '../types/user.type';
import { UserService } from '../services/user/user.service';
import { OrderService } from '../services/order/order.service';
import { StripeService } from '../services/stripe/stripe.service';
import { firstValueFrom, of, switchMap } from 'rxjs';

@Component({
  selector: 'app-cart',
  imports: [
    FontAwesomeModule,
    CommonModule,
    RatingsComponent,
    ReactiveFormsModule,
    NgClass,
  ],
  templateUrl: './cart.component.html',
  styleUrl: './cart.component.css',
})
export class CartComponent {
  faTrash = faTrash;
  faBoxOpen = faBoxOpen;
  faShoppingCart = faShoppingCart;

  alertType: number = 0; //new
  alertMessage: string = '';
  disableCheckout: boolean = false;
  paymentSuccess = signal(false); //new


  user = signal<LoggedInUser>({
    firstName: '',
    lastName: '',
    address: '',
    city: '',
    state: '',
    pin: '',
    email: '', //new
  });

  orderForm: WritableSignal<FormGroup>;

  constructor(
    public cartStore: CartStoreItem,
    private router: Router,
    private userService: UserService,
    private fb: FormBuilder,
    private orderService: OrderService, 
    private route: ActivatedRoute,
    private stripeService: StripeService //new

  ) {
    this.orderForm = signal(this.createOrderForm(this.user()));
    this.userService.loggedInUser$.subscribe((u) => this.user.set(u));

    effect(() => {
      if (this.paymentSuccess()) {
        return;
      }
      const newUser = this.user();
      this.orderForm.set(this.createOrderForm(newUser));
    });
    
      // Handle Stripe redirect query params
    this.route.queryParams
      .pipe(
        switchMap(async (params) => {
          if (params['status'] === 'success' && !this.paymentSuccess()) {
            this.paymentSuccess.set(true);

            // Restore form from localStorage
            const storedFormData = localStorage.getItem('orderFormData');
            if (storedFormData) {
              try {
                const formData = JSON.parse(storedFormData);
                this.orderForm().patchValue(formData);
                localStorage.removeItem('orderFormData');
                // Wait for userService to emit the logged-in user
                 const user = await firstValueFrom(
                  this.userService.loggedInUser$
                );
                if (user) {
                  this.user.set(user);
                  this.saveOrder();
                }
              } catch (error) {
                console.error('Error parsing stored form data:', error);
                this.alertType = 2;
                this.alertMessage =
                  'Failed to restore your address. Please retry.';
                return of(null);
              }
            }
            return this.userService.loggedInUser$;
          } else if (params['status'] === 'cancel') {
            this.alertType = 2;
            this.alertMessage = 'Payment was cancelled.';
            return of(null);
          } else {
            return of(null);
          }
        })
      ).subscribe();
      

    this.userService.loggedInUser$.subscribe((u) => this.user.set(u));
  }

  private createOrderForm(user: LoggedInUser | null): FormGroup {
    return this.fb.group({
      name: [
        user?.firstName && user?.lastName
          ? `${user.firstName} ${user.lastName}`.trim()
          : '',
        Validators.required,
      ],
      address: [user?.address || '', Validators.required],
      city: [user?.city || '', Validators.required],
      state: [user?.state || '', Validators.required],
      pin: [user?.pin || '', Validators.required],
    });
  }

  navigateToHome(): void {
    this.router.navigate(['home/products']);
  }

  updateQuantity($event: any, cartItem: CartItem): void {
    if ($event.target.innerText === '+') {
      this.cartStore.addProduct(cartItem.product);
    } else if ($event.target.innerText === '-') {
      this.cartStore.decreaseProductQuantity(cartItem);
    }
  }

  removeItem(cartItem: CartItem): void {
    this.cartStore.removeProduct(cartItem);
  }

  checkout(): void {
    if (!this.userService.isUserAuthenticated) {
      this.alertType = 2;
      this.alertMessage = 'Please log in to proceed with payment.';
      return;
    }

    if (this.cartStore.cart().products.length > 0 && this.orderForm().valid) {
      localStorage.setItem(
        'orderFormData',
        JSON.stringify(this.orderForm().value)
      );
      this.stripeService.redirectToCheckout(this.cartStore.cart().products);
    } else {
      this.alertType = 2;
      this.alertMessage = 'Please fill in the delivery address to continue.';
    }
  }

  private saveOrder(): void {
    //new
    if (!this.userService.isUserAuthenticated) {
      this.alertType = 2;
      this.alertMessage = 'Please log in to register your order.';
      return;
    }

    const form = this.orderForm();

    if (form.invalid) {
      this.alertType = 2;
      this.alertMessage = 'Please fill out all required fields correctly.';
      return;
    }

    const deliveryAddress = {
      userName: form.get('name')?.value,
      address: form.get('address')?.value,
      city: form.get('city')?.value,
      state: form.get('state')?.value,
      pin: form.get('pin')?.value,
    };

    const email = this.user()?.email;

    if (!email) {
      this.alertType = 2;
      this.alertMessage = 'User email not found. Please log in again.';
      return;
    }

    this.orderService.saveOrder(deliveryAddress, email).subscribe({
      next: (result) => {
        this.cartStore.clearCart();
        this.alertType = 0;
        this.alertMessage = 'Order placed successfully!';
        this.cartStore.clearCart();
        // Reset form and disable button
        this.orderForm.set(this.createOrderForm(this.user()));
        this.disableCheckout = true;
      },
      error: (error) => {
        this.alertType = 2;
        if (error.error?.message === 'Authorization failed!') {
          this.alertMessage = 'Please log in to register your order.';
        } else {
          this.alertMessage =
            error.error?.message || 'An unexpected error occurred.';
        }
      },
    });
  }
}
