export interface FormState {
    email: string;
    country: string | undefined;
    type: 'INDIVIDUAL' | 'ORGANIZATION';
    companyLegalName: string;
    firstName: string;
    infix: string;
    lastName: string;
    addressLine1: string;
    addressLine2: string;
    postalCode: string;
    city: string;
    state: string;
    timezone: string;
}
