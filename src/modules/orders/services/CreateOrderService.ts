import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateProductService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,

    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,

    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customer = await this.customersRepository.findById(customer_id);
    if (!customer) {
      throw new AppError('Customer does not exists.');
    }

    const productsIdsArray = products.map(product => ({ id: product.id }));

    const productsFounded = await this.productsRepository.findAllById(
      productsIdsArray,
    );

    if (productsFounded.length !== products.length) {
      throw new AppError('Some product does not exist.');
    }

    const updatedProductArray: {
      product_id: string;
      price: number;
      quantity: number;
    }[] = [];

    let limitQuantity = true;
    let productName = '';
    products.forEach(product => {
      productsFounded.forEach(productFounded => {
        if (product.id === productFounded.id) {
          if (product.quantity > productFounded.quantity) {
            limitQuantity = false;
            productName = productFounded.name;
          }

          updatedProductArray.push({
            product_id: product.id,
            price: productFounded.price,
            quantity: product.quantity,
          });

          productFounded.quantity -= product.quantity;
        }
      });
    });

    if (!limitQuantity) {
      throw new AppError(
        `Quantity of the product ${productName} is bigger than the stock.`,
      );
    }

    await this.productsRepository.updateQuantity(productsFounded);

    const order = await this.ordersRepository.create({
      customer,
      products: updatedProductArray,
    });

    return order;
  }
}

export default CreateProductService;
